/*
 * Agni SDK Code Generator
 * Generates live SDK snippets that reflect the user's playground inputs.
 * Reads form values from the Agni Playground and produces code in 8 languages.
 */
(function () {
  "use strict";

  var LANGS = [
    { id: "curl",   label: "cURL" },
    { id: "python", label: "Python" },
    { id: "js",     label: "JavaScript" },
    { id: "go",     label: "Go" },
    { id: "ruby",   label: "Ruby" },
    { id: "php",    label: "PHP" },
    { id: "java",   label: "Java" },
    { id: "csharp", label: "C#" }
  ];

  var STORAGE_LANG = "agni-sdk-lang";

  function escStr(s) { return (s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }

  // ===== CODE GENERATORS =====

  function genCurl(method, url, apiKey, body) {
    var lines = ['curl -X ' + method + ' "' + url + '" \\'];
    lines.push('  -H "X-Api-Key: ' + escStr(apiKey) + '" \\');
    if (body) {
      lines.push('  -H "Content-Type: application/json" \\');
      lines.push("  -d '" + JSON.stringify(body, null, 2).split("\n").join("\n  ") + "'");
    } else {
      // Remove trailing backslash from last line
      lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, "");
    }
    return lines.join("\n");
  }

  function genPython(method, url, apiKey, body) {
    var lines = ['import requests', ''];
    var fn = method === "GET" ? "get" : method === "POST" ? "post" : method === "PUT" ? "put" : method === "PATCH" ? "patch" : method === "DELETE" ? "delete" : "request";
    lines.push('response = requests.' + fn + '(');
    lines.push('    "' + url + '",');
    lines.push('    headers={');
    lines.push('        "X-Api-Key": "' + escStr(apiKey) + '",');
    if (body) lines.push('        "Content-Type": "application/json"');
    else { lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, ""); }
    lines.push('    },');
    if (body) {
      lines.push('    json=' + pyDict(body, 4));
    }
    // Remove trailing comma from last param
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
    lines.push(')');
    lines.push('print(response.json())');
    return lines.join("\n");
  }

  function pyDict(obj, indent) {
    var pad = " ".repeat(indent);
    var inner = " ".repeat(indent + 4);
    if (obj === null || obj === undefined) return "None";
    if (typeof obj === "boolean") return obj ? "True" : "False";
    if (typeof obj === "number") return String(obj);
    if (typeof obj === "string") return '"' + escStr(obj) + '"';
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      var items = obj.map(function (v) { return inner + pyDict(v, indent + 4); });
      return "[\n" + items.join(",\n") + "\n" + pad + "]";
    }
    var keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    var entries = keys.map(function (k) {
      return inner + '"' + escStr(k) + '": ' + pyDict(obj[k], indent + 4);
    });
    return "{\n" + entries.join(",\n") + "\n" + pad + "}";
  }

  function genJs(method, url, apiKey, body) {
    var lines = [];
    lines.push('const response = await fetch("' + url + '", {');
    lines.push('  method: "' + method + '",');
    lines.push('  headers: {');
    lines.push('    "X-Api-Key": "' + escStr(apiKey) + '",');
    if (body) lines.push('    "Content-Type": "application/json"');
    else { lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, ""); }
    lines.push('  },');
    if (body) {
      lines.push('  body: JSON.stringify(' + JSON.stringify(body, null, 2).split("\n").join("\n  ") + ')');
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
    lines.push('});');
    lines.push('const data = await response.json();');
    lines.push('console.log(data);');
    return lines.join("\n");
  }

  function genGo(method, url, apiKey, body) {
    var lines = ['package main', '', 'import (', '\t"fmt"', '\t"net/http"'];
    if (body) { lines.push('\t"bytes"'); lines.push('\t"encoding/json"'); }
    lines.push('\t"io"');
    lines.push(')', '', 'func main() {');

    if (body) {
      lines.push('\tjsonBody, _ := json.Marshal(map[string]interface{}{');
      Object.keys(body).forEach(function (k) {
        var v = body[k];
        if (typeof v === "string") lines.push('\t\t"' + k + '": "' + escStr(v) + '",');
        else if (typeof v === "boolean") lines.push('\t\t"' + k + '": ' + v + ',');
        else if (typeof v === "number") lines.push('\t\t"' + k + '": ' + v + ',');
        else lines.push('\t\t"' + k + '": ' + JSON.stringify(v) + ',');
      });
      lines.push('\t})');
      lines.push('\treq, _ := http.NewRequest("' + method + '", "' + url + '", bytes.NewBuffer(jsonBody))');
    } else {
      lines.push('\treq, _ := http.NewRequest("' + method + '", "' + url + '", nil)');
    }

    lines.push('\treq.Header.Set("X-Api-Key", "' + escStr(apiKey) + '")');
    if (body) lines.push('\treq.Header.Set("Content-Type", "application/json")');
    lines.push('\tclient := &http.Client{}');
    lines.push('\tresp, _ := client.Do(req)');
    lines.push('\tdefer resp.Body.Close()');
    lines.push('\tbody, _ := io.ReadAll(resp.Body)');
    lines.push('\tfmt.Println(string(body))');
    lines.push('}');
    return lines.join("\n");
  }

  function genRuby(method, url, apiKey, body) {
    var u = new URL(url);
    var httpMethod = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
    // Map methods to Ruby Net::HTTP classes
    if (method === "PATCH") httpMethod = "Patch";
    if (method === "DELETE") httpMethod = "Delete";

    var lines = ['require "net/http"', 'require "json"', 'require "uri"', ''];
    lines.push('uri = URI("' + url + '")');
    lines.push('http = Net::HTTP.new(uri.host, uri.port)');
    lines.push('http.use_ssl = true');
    lines.push('');
    lines.push('request = Net::HTTP::' + httpMethod + '.new(uri)');
    lines.push('request["X-Api-Key"] = "' + escStr(apiKey) + '"');
    if (body) {
      lines.push('request["Content-Type"] = "application/json"');
      lines.push('request.body = ' + JSON.stringify(body, null, 2).split("\n").join("\n"));
    }
    lines.push('');
    lines.push('response = http.request(request)');
    lines.push('puts response.body');
    return lines.join("\n");
  }

  function genPhp(method, url, apiKey, body) {
    var lines = ['<?php', ''];
    lines.push('$ch = curl_init("' + url + '");');
    lines.push('curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);');
    lines.push('curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "' + method + '");');
    var headers = "'X-Api-Key: " + escStr(apiKey) + "'";
    if (body) headers += ", 'Content-Type: application/json'";
    lines.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [' + headers + ']);');
    if (body) {
      lines.push('curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(' + phpArray(body, 1) + '));');
    }
    lines.push('');
    lines.push('$response = curl_exec($ch);');
    lines.push('curl_close($ch);');
    lines.push('echo $response;');
    return lines.join("\n");
  }

  function phpArray(obj, indent) {
    var pad = "\t".repeat(indent);
    var inner = "\t".repeat(indent + 1);
    if (obj === null || obj === undefined) return "null";
    if (typeof obj === "boolean") return obj ? "true" : "false";
    if (typeof obj === "number") return String(obj);
    if (typeof obj === "string") return '"' + escStr(obj) + '"';
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      var items = obj.map(function (v) { return inner + phpArray(v, indent + 1); });
      return "[\n" + items.join(",\n") + "\n" + pad + "]";
    }
    var keys = Object.keys(obj);
    if (keys.length === 0) return "[]";
    var entries = keys.map(function (k) {
      return inner + '"' + escStr(k) + '" => ' + phpArray(obj[k], indent + 1);
    });
    return "[\n" + entries.join(",\n") + ",\n" + pad + "]";
  }

  function genJava(method, url, apiKey, body) {
    var lines = ['import java.net.http.*;', 'import java.net.URI;', ''];
    lines.push('HttpClient client = HttpClient.newHttpClient();');
    if (body) {
      lines.push('String json = ' + javaJsonStr(body) + ';');
    }
    lines.push('HttpRequest request = HttpRequest.newBuilder()');
    lines.push('    .uri(URI.create("' + url + '"))');
    if (body) {
      lines.push('    .method("' + method + '", HttpRequest.BodyPublishers.ofString(json))');
    } else if (method === "DELETE") {
      lines.push('    .DELETE()');
    } else {
      lines.push('    .GET()');
    }
    lines.push('    .header("X-Api-Key", "' + escStr(apiKey) + '")');
    if (body) lines.push('    .header("Content-Type", "application/json")');
    lines.push('    .build();');
    lines.push('');
    lines.push('HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());');
    lines.push('System.out.println(response.body());');
    return lines.join("\n");
  }

  function javaJsonStr(obj) {
    var s = JSON.stringify(obj);
    return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }

  function genCsharp(method, url, apiKey, body) {
    var lines = ['using var client = new HttpClient();'];
    lines.push('client.DefaultRequestHeaders.Add("X-Api-Key", "' + escStr(apiKey) + '");');
    lines.push('');

    var csMethod;
    if (method === "GET") csMethod = "GetAsync";
    else if (method === "POST") csMethod = "PostAsync";
    else if (method === "PUT") csMethod = "PutAsync";
    else if (method === "PATCH") csMethod = "PatchAsync";
    else if (method === "DELETE") csMethod = "DeleteAsync";
    else csMethod = "SendAsync";

    if (body) {
      lines.push('var json = @"' + JSON.stringify(body, null, 2).replace(/"/g, '""') + '";');
      lines.push('var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");');
      lines.push('var response = await client.' + csMethod + '("' + url + '", content);');
    } else {
      if (method === "DELETE") {
        lines.push('var response = await client.DeleteAsync("' + url + '");');
      } else {
        lines.push('var response = await client.GetAsync("' + url + '");');
      }
    }
    lines.push('var body = await response.Content.ReadAsStringAsync();');
    lines.push('Console.WriteLine(body);');
    return lines.join("\n");
  }

  var generators = {
    curl: genCurl,
    python: genPython,
    js: genJs,
    go: genGo,
    ruby: genRuby,
    php: genPhp,
    java: genJava,
    csharp: genCsharp
  };

  // ===== BUILD SDK PANEL =====

  function init() {
    var playground = document.getElementById("agni-playground");
    if (!playground) return;

    // Read endpoint info from playground header
    var methodEl = playground.querySelector(".agni-pg-method");
    var pathEl = playground.querySelector(".agni-pg-path");
    if (!methodEl || !pathEl) return;

    var endpointMethod = methodEl.textContent.trim().toUpperCase();
    var endpointPath = pathEl.textContent.trim();

    // Create SDK container
    var sdk = document.createElement("div");
    sdk.id = "agni-sdk";

    // Header
    var header = document.createElement("div");
    header.className = "agni-sdk-header";

    var title = document.createElement("span");
    title.className = "agni-sdk-title";
    title.textContent = "SDK Examples";

    var copyBtn = document.createElement("button");
    copyBtn.className = "agni-sdk-copy";
    copyBtn.textContent = "Copy";
    copyBtn.type = "button";

    header.appendChild(title);
    header.appendChild(copyBtn);

    // Tabs
    var tabs = document.createElement("div");
    tabs.className = "agni-sdk-tabs";

    var savedLang = localStorage.getItem(STORAGE_LANG) || "curl";
    var activeLang = savedLang;
    var tabEls = {};

    LANGS.forEach(function (lang) {
      var tab = document.createElement("button");
      tab.className = "agni-sdk-tab" + (lang.id === activeLang ? " active" : "");
      tab.textContent = lang.label;
      tab.type = "button";
      tab.dataset.lang = lang.id;
      tab.addEventListener("click", function () {
        activeLang = lang.id;
        localStorage.setItem(STORAGE_LANG, lang.id);
        Object.keys(tabEls).forEach(function (k) {
          tabEls[k].className = "agni-sdk-tab" + (k === activeLang ? " active" : "");
        });
        updateCode();
      });
      tabEls[lang.id] = tab;
      tabs.appendChild(tab);
    });

    // Code block
    var codeWrap = document.createElement("pre");
    codeWrap.className = "agni-sdk-code";
    var codeEl = document.createElement("code");
    codeWrap.appendChild(codeEl);

    // Copy handler
    copyBtn.addEventListener("click", function () {
      navigator.clipboard.writeText(codeEl.textContent).then(function () {
        copyBtn.textContent = "Copied!";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500);
      });
    });

    sdk.appendChild(header);
    sdk.appendChild(tabs);
    sdk.appendChild(codeWrap);

    // Insert after playground
    playground.parentNode.insertBefore(sdk, playground.nextSibling);

    // ===== LIVE UPDATE =====
    function getFormValues() {
      var apiKey = "";
      var authInput = playground.querySelector(".agni-pg-input[type='password'], .agni-pg-input[type='text']");
      if (authInput) apiKey = authInput.value.trim() || "YOUR_API_KEY";

      // Path params
      var url = "https://api.ravan.ai" + endpointPath;
      var paramRows = playground.querySelectorAll(".agni-pg-param-row");
      paramRows.forEach(function (row) {
        var label = row.querySelector(".agni-pg-param-label");
        var input = row.querySelector(".agni-pg-input");
        if (label && input) {
          var name = label.textContent.replace(/\s*\*$/, "").trim();
          var val = input.value.trim();
          // Only replace path params (check if this name appears in the URL)
          if (url.indexOf("{" + name + "}") !== -1) {
            url = url.replace("{" + name + "}", val || "{" + name + "}");
          }
        }
      });

      // Query params
      var section = null;
      playground.querySelectorAll(".agni-pg-label").forEach(function (lbl) {
        if (lbl.textContent.trim() === "Query Parameters") section = lbl.parentElement;
      });
      if (section) {
        var qParts = [];
        section.querySelectorAll(".agni-pg-param-row").forEach(function (row) {
          var label = row.querySelector(".agni-pg-param-label");
          var input = row.querySelector(".agni-pg-input");
          if (label && input && input.value.trim()) {
            qParts.push(encodeURIComponent(label.textContent.replace(/\s*\*$/, "").trim()) + "=" + encodeURIComponent(input.value.trim()));
          }
        });
        if (qParts.length > 0) url += "?" + qParts.join("&");
      }

      // Body
      var body = null;
      var textarea = playground.querySelector(".agni-pg-textarea");
      if (textarea && textarea.value.trim()) {
        try { body = JSON.parse(textarea.value.trim()); } catch (e) { body = null; }
      }

      return { method: endpointMethod, url: url, apiKey: apiKey, body: body };
    }

    function updateCode() {
      var vals = getFormValues();
      var gen = generators[activeLang];
      if (gen) {
        codeEl.textContent = gen(vals.method, vals.url, vals.apiKey, vals.body);
      }
    }

    // Listen for input changes in the playground
    playground.addEventListener("input", function () {
      clearTimeout(playground._sdkTimer);
      playground._sdkTimer = setTimeout(updateCode, 200);
    });

    // Initial render
    updateCode();
  }

  // Wait for playground to be built first (max 10 seconds)
  var waitAttempts = 0;
  function waitForPlayground() {
    if (document.getElementById("agni-playground")) {
      init();
    } else if (waitAttempts < 30) {
      waitAttempts++;
      setTimeout(waitForPlayground, 350);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(waitForPlayground, 1500); });
  } else {
    setTimeout(waitForPlayground, 1500);
  }
})();
