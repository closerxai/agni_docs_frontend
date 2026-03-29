/*
 * Agni API Playground — Custom "Try It" panel
 * Sends requests directly to api.ravan.ai (no proxy)
 */
(function () {
  "use strict";

  var API_BASE = "https://api.ravan.ai";
  var SPEC_URL = "/openapi.json";
  var STORAGE_KEY = "agni-api-key";

  // Only on API reference pages (skip intro/webhooks)
  var pagePath = window.location.pathname.replace(/\/$/, "");
  if (pagePath.indexOf("/api-reference/") === -1) return;
  if (pagePath.indexOf("introduction") !== -1) return;
  if (pagePath.indexOf("after-call") !== -1) return;

  var spec = null;

  // ===== ENDPOINT MATCHING =====
  // Map page URL slugs to openapi operationIds/paths
  // e.g. /api-reference/agents/create -> POST /api/v1/agents/
  // e.g. /api-reference/agents/get -> GET /api/v1/agents/{id}/

  // Build keyword hints from the last URL segment
  function getSlugHints(slug) {
    var hints = { method: null, keywords: [] };
    if (slug === "create") { hints.method = "POST"; }
    else if (slug === "list") { hints.method = "GET"; hints.keywords.push("list"); }
    else if (slug === "get") { hints.method = "GET"; hints.keywords.push("get"); }
    else if (slug === "update") { hints.method = "PATCH"; }
    else if (slug === "delete") { hints.method = "DELETE"; }
    else if (slug === "start") { hints.method = "POST"; hints.keywords.push("start"); }
    else if (slug === "pause") { hints.method = "POST"; hints.keywords.push("pause"); }
    else if (slug === "resume") { hints.method = "POST"; hints.keywords.push("resume"); }
    else if (slug === "health") { hints.method = "GET"; hints.keywords.push("health"); }
    else if (slug === "ready") { hints.method = "GET"; hints.keywords.push("ready"); }
    else { hints.keywords.push(slug); }
    return hints;
  }

  function findEndpoint(spec) {
    // Parse page path: /api-reference/agents/create -> group="agents", action="create"
    var parts = pagePath.replace("/api-reference/", "").split("/");
    if (parts.length < 2) return null;
    var group = parts[0]; // agents, tools, campaigns, etc
    var action = parts.slice(1).join("-"); // create, list, get, update-status, etc
    var hints = getSlugHints(parts[parts.length - 1]);

    // Group -> API path segment mapping
    var groupMap = {
      "agents": "agents",
      "tools": "tools",
      "campaigns": "campaigns",
      "contacts": "contacts",
      "telephony": "phone-numbers",
      "calcom": "calcom",
      "ghl": "ghl",
      "rag": "rag",
      "health": "",
      "webhooks": "webhooks",
      "appointments": "",
      "widget-settings": "widget-settings"
    };

    var apiSegment = groupMap[group];
    if (apiSegment === undefined) return null;

    var paths = spec.paths;
    var bestMatch = null;
    var bestScore = -1;

    Object.keys(paths).forEach(function (pathKey) {
      var methods = paths[pathKey];
      Object.keys(methods).forEach(function (httpMethod) {
        if (["get", "post", "put", "patch", "delete"].indexOf(httpMethod) === -1) return;
        var op = methods[httpMethod];
        var opId = (op.operationId || "").toLowerCase();
        var summary = (op.summary || "").toLowerCase();
        var score = 0;

        // Must contain the group's API segment
        if (apiSegment && pathKey.indexOf(apiSegment) === -1) return;

        // Health endpoints special case
        if (group === "health") {
          if (action === "health" && pathKey === "/health") score += 100;
          else if (action === "ready" && pathKey === "/ready") score += 100;
          else return;
        }

        // Appointments special case
        if (group === "appointments") {
          if (pathKey.indexOf("appointments/manage") !== -1) score += 50;
          if (action.indexOf("calcom") !== -1 && pathKey.indexOf("calcom") !== -1) score += 50;
          if (action.indexOf("ghl") !== -1 && pathKey.indexOf("ghl") !== -1) score += 50;
        }

        // Method match
        if (hints.method && httpMethod.toUpperCase() === hints.method) score += 30;

        // Action name matches operationId or summary
        var actionWords = action.split("-");
        actionWords.forEach(function (w) {
          if (opId.indexOf(w) !== -1) score += 15;
          if (summary.indexOf(w) !== -1) score += 10;
        });

        // Keyword hints
        hints.keywords.forEach(function (kw) {
          if (opId.indexOf(kw) !== -1) score += 15;
          if (summary.indexOf(kw) !== -1) score += 10;
        });

        // Penalize paths with extra segments if action is simple
        var pathSegments = pathKey.split("/").filter(Boolean).length;
        if (action === "list" || action === "create") {
          // Simple actions should match simpler paths
          if (pathSegments <= 4) score += 5;
        }

        // Exact slug in operationId
        var actionJoined = action.replace(/-/g, "");
        if (opId.indexOf(actionJoined) !== -1) score += 25;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = { method: httpMethod.toUpperCase(), path: pathKey, operation: op };
        }
      });
    });

    return bestMatch && bestScore > 20 ? bestMatch : null;
  }

  // ===== SCHEMA UTILITIES =====

  function resolveRef(ref) {
    if (!ref || !spec) return {};
    var parts = ref.replace("#/", "").split("/");
    var obj = spec;
    for (var i = 0; i < parts.length; i++) {
      if (!obj) return {};
      obj = obj[parts[i]];
    }
    return obj || {};
  }

  function resolveSchema(schema) {
    if (!schema) return {};
    if (schema.$ref) return resolveRef(schema.$ref);
    return schema;
  }

  function generateTemplate(schema, depth) {
    depth = depth || 0;
    if (depth > 3) return {};
    schema = resolveSchema(schema);
    if (!schema || !schema.properties) return {};

    var obj = {};
    var props = schema.properties;
    var required = schema.required || [];

    Object.keys(props).forEach(function (key) {
      var prop = resolveSchema(props[key]);
      if (depth > 0 && required.indexOf(key) === -1) return;

      if (prop.example !== undefined) {
        obj[key] = prop.example;
      } else if (prop["enum"] && prop["enum"].length > 0) {
        obj[key] = prop["enum"][0];
      } else if (prop.type === "string") {
        obj[key] = "";
      } else if (prop.type === "integer" || prop.type === "number") {
        obj[key] = 0;
      } else if (prop.type === "boolean") {
        obj[key] = false;
      } else if (prop.type === "array") {
        if (prop.items) {
          var itemSchema = resolveSchema(prop.items);
          if (itemSchema.type === "string") obj[key] = [""];
          else if (itemSchema.type === "integer" || itemSchema.type === "number") obj[key] = [0];
          else if (itemSchema.properties) obj[key] = [generateTemplate(itemSchema, depth + 1)];
          else obj[key] = [];
        } else {
          obj[key] = [];
        }
      } else if (prop.type === "object" || prop.properties) {
        obj[key] = generateTemplate(prop, depth + 1);
      } else {
        obj[key] = "";
      }
    });
    return obj;
  }

  function getMethodColor(method) {
    var m = method.toUpperCase();
    if (m === "GET") return "#10b981";
    if (m === "POST") return "#3b82f6";
    if (m === "PUT") return "#f59e0b";
    if (m === "PATCH") return "#8b5cf6";
    if (m === "DELETE") return "#ef4444";
    return "#6b7280";
  }

  // ===== BUILD PLAYGROUND =====

  function buildPlayground(endpointMethod, endpointPath, operation) {
    var article = document.querySelector("article") || document.querySelector('[role="main"]') || document.querySelector("main");
    if (!article) return;

    var h1 = article.querySelector("h1");

    // --- Main container ---
    var container = document.createElement("div");
    container.id = "agni-playground";

    // --- Header: method badge + path ---
    var header = document.createElement("div");
    header.className = "agni-pg-header";

    var badge = document.createElement("span");
    badge.className = "agni-pg-method";
    badge.textContent = endpointMethod;
    badge.style.background = getMethodColor(endpointMethod);

    var pathEl = document.createElement("code");
    pathEl.className = "agni-pg-path";
    pathEl.textContent = endpointPath;

    var titleRight = document.createElement("span");
    titleRight.className = "agni-pg-title-right";
    titleRight.textContent = "API Playground";

    header.appendChild(badge);
    header.appendChild(pathEl);
    header.appendChild(titleRight);
    container.appendChild(header);

    // --- Auth ---
    var authWrap = document.createElement("div");
    authWrap.className = "agni-pg-section";

    var authLabel = document.createElement("label");
    authLabel.className = "agni-pg-label";
    authLabel.innerHTML = 'X-Api-Key <span class="agni-pg-required">*</span>';

    var authRow = document.createElement("div");
    authRow.className = "agni-pg-auth-row";

    var authInput = document.createElement("input");
    authInput.className = "agni-pg-input";
    authInput.type = "password";
    authInput.placeholder = "Enter your API key…";
    authInput.value = localStorage.getItem(STORAGE_KEY) || "";
    authInput.addEventListener("input", function () {
      localStorage.setItem(STORAGE_KEY, authInput.value);
    });

    var toggleVis = document.createElement("button");
    toggleVis.className = "agni-pg-toggle-vis";
    toggleVis.textContent = "Show";
    toggleVis.type = "button";
    toggleVis.addEventListener("click", function () {
      var isHidden = authInput.type === "password";
      authInput.type = isHidden ? "text" : "password";
      toggleVis.textContent = isHidden ? "Hide" : "Show";
    });

    authRow.appendChild(authInput);
    authRow.appendChild(toggleVis);
    authWrap.appendChild(authLabel);
    authWrap.appendChild(authRow);
    container.appendChild(authWrap);

    // --- Path parameters ---
    var pathParams = [];
    var pathParamInputs = {};
    var pathMatches = endpointPath.match(/\{(\w+)\}/g);

    if (pathMatches && pathMatches.length > 0) {
      var ppSection = document.createElement("div");
      ppSection.className = "agni-pg-section";

      var ppLabel = document.createElement("div");
      ppLabel.className = "agni-pg-label";
      ppLabel.textContent = "Path Parameters";
      ppSection.appendChild(ppLabel);

      pathMatches.forEach(function (match) {
        var name = match.replace(/[{}]/g, "");
        pathParams.push(name);

        var paramDef = null;
        (operation.parameters || []).forEach(function (p) {
          if (p.name === name && p["in"] === "path") paramDef = p;
        });

        var row = document.createElement("div");
        row.className = "agni-pg-param-row";

        var lbl = document.createElement("label");
        lbl.className = "agni-pg-param-label";
        lbl.innerHTML = name + ' <span class="agni-pg-required">*</span>';

        var inp = document.createElement("input");
        inp.className = "agni-pg-input";
        inp.placeholder = paramDef ? (paramDef.description || name) : name;

        pathParamInputs[name] = inp;

        row.appendChild(lbl);
        row.appendChild(inp);
        ppSection.appendChild(row);
      });

      container.appendChild(ppSection);
    }

    // --- Query parameters ---
    var queryParams = [];
    var queryParamInputs = {};
    (operation.parameters || []).forEach(function (p) {
      if (p["in"] === "query") queryParams.push(p);
    });

    if (queryParams.length > 0) {
      var qpSection = document.createElement("div");
      qpSection.className = "agni-pg-section";

      var qpLabel = document.createElement("div");
      qpLabel.className = "agni-pg-label";
      qpLabel.textContent = "Query Parameters";
      qpSection.appendChild(qpLabel);

      queryParams.forEach(function (param) {
        var row = document.createElement("div");
        row.className = "agni-pg-param-row";

        var lbl = document.createElement("label");
        lbl.className = "agni-pg-param-label";
        lbl.textContent = param.name;
        if (param.required) {
          lbl.innerHTML = param.name + ' <span class="agni-pg-required">*</span>';
        }

        var inp = document.createElement("input");
        inp.className = "agni-pg-input";
        inp.placeholder = param.description || param.name;
        if (param.schema && param.schema["default"] !== undefined) {
          inp.value = String(param.schema["default"]);
        }

        queryParamInputs[param.name] = inp;

        row.appendChild(lbl);
        row.appendChild(inp);
        qpSection.appendChild(row);
      });

      container.appendChild(qpSection);
    }

    // --- Request body ---
    var bodyTextarea = null;

    if (operation.requestBody) {
      var content = operation.requestBody.content;
      var jsonContent = content && content["application/json"];
      var jsonSchema = jsonContent && jsonContent.schema;

      if (jsonSchema) {
        var bodySection = document.createElement("div");
        bodySection.className = "agni-pg-section";

        var bodyLabel = document.createElement("div");
        bodyLabel.className = "agni-pg-label";
        bodyLabel.textContent = "Request Body";

        bodyTextarea = document.createElement("textarea");
        bodyTextarea.className = "agni-pg-textarea";
        bodyTextarea.spellcheck = false;

        var template = generateTemplate(jsonSchema, 0);
        bodyTextarea.value = JSON.stringify(template, null, 2);

        function autoResize() {
          bodyTextarea.style.height = "auto";
          bodyTextarea.style.height = Math.min(Math.max(bodyTextarea.scrollHeight, 120), 400) + "px";
        }
        bodyTextarea.addEventListener("input", autoResize);

        bodySection.appendChild(bodyLabel);
        bodySection.appendChild(bodyTextarea);
        container.appendChild(bodySection);

        setTimeout(autoResize, 50);
      }
    }

    // --- Send button ---
    var sendBtn = document.createElement("button");
    sendBtn.className = "agni-pg-send";
    sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;vertical-align:-2px"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>Send Request';
    container.appendChild(sendBtn);

    // --- Response panel ---
    var responseSection = document.createElement("div");
    responseSection.className = "agni-pg-response";
    responseSection.style.display = "none";

    var resHeader = document.createElement("div");
    resHeader.className = "agni-pg-response-header";

    var resStatusWrap = document.createElement("div");
    resStatusWrap.className = "agni-pg-response-status-wrap";

    var resLabel = document.createElement("span");
    resLabel.className = "agni-pg-response-label";
    resLabel.textContent = "Response";

    var resStatus = document.createElement("span");
    resStatus.className = "agni-pg-response-status";

    var resTime = document.createElement("span");
    resTime.className = "agni-pg-response-time";

    resStatusWrap.appendChild(resLabel);
    resStatusWrap.appendChild(resStatus);
    resHeader.appendChild(resStatusWrap);
    resHeader.appendChild(resTime);

    var resBody = document.createElement("pre");
    resBody.className = "agni-pg-response-body";

    responseSection.appendChild(resHeader);
    responseSection.appendChild(resBody);
    container.appendChild(responseSection);

    // --- Insert into page ---
    if (h1 && h1.parentNode) {
      var ref = h1.nextElementSibling;
      while (ref && ref.classList && ref.classList.contains("agni-reading-time")) {
        ref = ref.nextElementSibling;
      }
      h1.parentNode.insertBefore(container, ref);
    } else {
      article.insertBefore(container, article.firstChild);
    }

    // ===== SEND HANDLER =====
    sendBtn.addEventListener("click", function () {
      var apiKey = authInput.value.trim();
      if (!apiKey) {
        authInput.style.borderColor = "#ef4444";
        authInput.focus();
        setTimeout(function () { authInput.style.borderColor = ""; }, 2000);
        return;
      }

      var url = API_BASE + endpointPath;
      var missingParam = false;

      pathParams.forEach(function (name) {
        var val = pathParamInputs[name].value.trim();
        if (!val) {
          pathParamInputs[name].style.borderColor = "#ef4444";
          missingParam = true;
          setTimeout(function () { pathParamInputs[name].style.borderColor = ""; }, 2000);
        }
        url = url.replace("{" + name + "}", encodeURIComponent(val));
      });

      if (missingParam) return;

      var qParts = [];
      Object.keys(queryParamInputs).forEach(function (key) {
        var val = queryParamInputs[key].value.trim();
        if (val) qParts.push(encodeURIComponent(key) + "=" + encodeURIComponent(val));
      });
      if (qParts.length > 0) url += "?" + qParts.join("&");

      var opts = {
        method: endpointMethod,
        headers: { "X-Api-Key": apiKey }
      };

      if (bodyTextarea && ["POST", "PUT", "PATCH"].indexOf(endpointMethod) !== -1) {
        var bodyVal = bodyTextarea.value.trim();
        if (bodyVal) {
          try {
            JSON.parse(bodyVal);
            opts.headers["Content-Type"] = "application/json";
            opts.body = bodyVal;
          } catch (e) {
            bodyTextarea.style.borderColor = "#ef4444";
            setTimeout(function () { bodyTextarea.style.borderColor = ""; }, 2000);
            resBody.textContent = "Invalid JSON in request body:\n" + e.message;
            responseSection.style.display = "block";
            resStatus.textContent = "Error";
            resStatus.className = "agni-pg-response-status error";
            resTime.textContent = "";
            return;
          }
        }
      }

      sendBtn.disabled = true;
      sendBtn.innerHTML = '<span class="agni-pg-spinner"></span>Sending…';
      responseSection.style.display = "none";

      var t0 = performance.now();

      fetch(url, opts)
        .then(function (response) {
          var elapsed = Math.round(performance.now() - t0);
          return response.text().then(function (text) {
            return { status: response.status, statusText: response.statusText, text: text, elapsed: elapsed };
          });
        })
        .then(function (result) {
          responseSection.style.display = "block";

          var ok = result.status >= 200 && result.status < 300;
          resStatus.textContent = result.status + " " + result.statusText;
          resStatus.className = "agni-pg-response-status " + (ok ? "success" : "error");
          resTime.textContent = result.elapsed + "ms";

          try {
            var json = JSON.parse(result.text);
            resBody.textContent = JSON.stringify(json, null, 2);
          } catch (e) {
            resBody.textContent = result.text || "(empty response)";
          }

          responseSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
        })
        .catch(function (err) {
          responseSection.style.display = "block";
          resStatus.textContent = "Network Error";
          resStatus.className = "agni-pg-response-status error";
          resTime.textContent = "";
          resBody.textContent = err.message + "\n\nMake sure CORS is enabled on the API server.";
        })
        .finally(function () {
          sendBtn.disabled = false;
          sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;vertical-align:-2px"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>Send Request';
        });
    });
  }

  // ===== INIT =====
  function init() {
    // Try meta tag first (injected by postbuild)
    var meta = document.querySelector('meta[name="agni-openapi"]');
    var metaMethod = null;
    var metaPath = null;

    if (meta) {
      var mc = meta.getAttribute("content");
      var mm = mc && mc.match(/^(\w+)\s+(.+)$/);
      if (mm) {
        metaMethod = mm[1].toUpperCase();
        metaPath = mm[2];
      }
    }

    fetch(SPEC_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (s) {
        spec = s;

        var method, endpointPath, operation;

        // If meta tag provided the endpoint, use it
        if (metaMethod && metaPath) {
          var pathDef = spec.paths[metaPath];
          if (!pathDef) {
            var alt = metaPath.endsWith("/") ? metaPath.slice(0, -1) : metaPath + "/";
            pathDef = spec.paths[alt];
            if (pathDef) metaPath = alt;
          }
          if (pathDef) {
            operation = pathDef[metaMethod.toLowerCase()];
            if (operation) {
              method = metaMethod;
              endpointPath = metaPath;
            }
          }
        }

        // Fallback: smart match from page URL
        if (!operation) {
          var match = findEndpoint(spec);
          if (match) {
            method = match.method;
            endpointPath = match.path;
            operation = match.operation;
          }
        }

        if (method && endpointPath && operation) {
          buildPlayground(method, endpointPath, operation);
          console.log("[Agni Playground] Loaded:", method, endpointPath);
        } else {
          console.log("[Agni Playground] No endpoint match for:", pagePath);
        }
      })
      .catch(function (err) {
        console.warn("[Agni Playground] Failed to load spec:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 1200); });
  } else {
    setTimeout(init, 1200);
  }
})();
