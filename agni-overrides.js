/*
 * Agni Docs - v3 Runtime Overrides
 * Search (Pagefind) + AI Assistant (Claude) + Rebrand
 */

// Suppress Mintlify errors
window.addEventListener("unhandledrejection", function (e) {
  if (e.reason && e.reason.message && /Connection closed|WebSocket|socket\.io|transport/i.test(e.reason.message)) e.preventDefault();
});
window.addEventListener("error", function (e) {
  if (e.message && /Connection closed|WebSocket|socket\.io|transport/i.test(e.message)) e.preventDefault();
});

// Block socket.io requests only — preserve all other fetch/XHR behavior
(function () {
  var origFetch = window.fetch;
  window.fetch = function (input) {
    try {
      var urlStr = typeof input === "string" ? input : (input && input.url ? input.url : "");
      if (urlStr.indexOf("socket.io") !== -1) {
        return Promise.resolve(new Response("blocked", { status: 499 }));
      }
    } catch (e) { /* pass through */ }
    return origFetch.apply(this, arguments);
  };
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (typeof url === "string" && url.indexOf("socket.io") !== -1) {
      this._blocked = true;
      return;
    }
    return origOpen.apply(this, arguments);
  };
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (this._blocked) return;
    return origSend.apply(this, arguments);
  };
})();

// Block Mintlify Ctrl+K
document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") e.stopImmediatePropagation();
}, true);

// ==================== MARKDOWN PARSER ====================
function renderMarkdown(src) {
  if (!src) return "";
  var lines = src.split("\n");
  var html = [];
  var inCode = false;
  var inList = false;
  var listType = "";

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // Code block toggle
    if (line.match(/^```/)) {
      if (inCode) {
        html.push('</code><button class="agni-copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(function(){event.target.textContent=\'Copied!\';setTimeout(function(){event.target.textContent=\'Copy\'},1500)})">Copy</button></pre>');
        inCode = false;
      } else {
        if (inList) { html.push(listType === "ul" ? "</ul>" : "</ol>"); inList = false; }
        var lang = line.replace(/^```/, "").trim();
        html.push('<pre class="agni-code-wrap"><code class="lang-' + (lang || "text") + '">');
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      html.push(escHtml(line) + "\n");
      continue;
    }

    // Close list if line is not a list item
    var isUl = /^[\-\*]\s+/.test(line);
    var isOl = /^\d+\.\s+/.test(line);
    if (inList && !isUl && !isOl && line.trim() !== "") {
      html.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
    }

    // Empty line
    if (line.trim() === "") {
      if (inList) { /* skip blank lines in lists */ }
      else { html.push(""); }
      continue;
    }

    // Headings
    if (line.match(/^### /)) { html.push("<h3>" + inlineMd(line.slice(4)) + "</h3>"); continue; }
    if (line.match(/^## /))  { html.push("<h2>" + inlineMd(line.slice(3)) + "</h2>"); continue; }
    if (line.match(/^# /))   { html.push("<h1>" + inlineMd(line.slice(2)) + "</h1>"); continue; }

    // Horizontal rule
    if (line.match(/^---+$/)) { html.push("<hr>"); continue; }

    // Blockquote
    if (line.match(/^>\s?/)) { html.push("<blockquote>" + inlineMd(line.replace(/^>\s?/, "")) + "</blockquote>"); continue; }

    // Unordered list
    if (isUl) {
      if (!inList || listType !== "ul") {
        if (inList) html.push(listType === "ul" ? "</ul>" : "</ol>");
        html.push("<ul>");
        inList = true; listType = "ul";
      }
      html.push("<li>" + inlineMd(line.replace(/^[\-\*]\s+/, "")) + "</li>");
      continue;
    }

    // Ordered list
    if (isOl) {
      if (!inList || listType !== "ol") {
        if (inList) html.push(listType === "ul" ? "</ul>" : "</ol>");
        html.push("<ol>");
        inList = true; listType = "ol";
      }
      html.push("<li>" + inlineMd(line.replace(/^\d+\.\s+/, "")) + "</li>");
      continue;
    }

    // Paragraph
    html.push("<p>" + inlineMd(line) + "</p>");
  }

  if (inCode) html.push("</code></pre>");
  if (inList) html.push(listType === "ul" ? "</ul>" : "</ol>");

  return html.join("\n");
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(s) {
  s = escHtml(s);
  // Bold
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

// ==================== MAIN INIT ====================
(function () {
  "use strict";

  // ===== CONTEXTUAL SUGGESTIONS PER PAGE =====
  var PAGE_SUGGESTIONS = {
    "/guides/agents": [
      "How do I configure agent speech settings?",
      "What dynamic variables can I use in prompts?",
      "How do I test my agent with a web call?",
      "What voice providers are available?"
    ],
    "/guides/authentication": [
      "How do I generate an API key?",
      "What authentication methods are supported?",
      "How does email verification work?"
    ],
    "/guides/calls": [
      "How do I filter call sessions?",
      "What call data is captured per session?",
      "How do I export call logs to CSV?"
    ],
    "/guides/dashboard": [
      "What metrics are shown on the dashboard?",
      "How do I create a new agent from the dashboard?",
      "What do the live visualizations show?"
    ],
    "/guides/appointments": [
      "How does appointment booking work?",
      "How do I connect GoHighLevel?",
      "How do I set up Cal.com integration?"
    ],
    "/guides/tools": [
      "How do I add a call transfer function?",
      "What built-in tool types are available?",
      "How does the End Call function work?"
    ],
    "/guides/phone-numbers": [
      "How do I buy a phone number?",
      "What is the BYOT setup?",
      "How do I set up telephony?"
    ],
    "/guides/billing": [
      "How do prepaid credits work?",
      "How do prepaid credits work?",
      "How can I optimize costs?"
    ],
    "/guides/analytics": [
      "What KPIs are tracked?",
      "How do I troubleshoot sentiment drops?",
      "Can I export analytics data?"
    ],
    "/api-reference": [
      "What authentication header do I need?",
      "What is the base URL for the API?",
      "How does pagination work?",
      "What error codes are returned?"
    ]
  };
  var DEFAULT_SUGGESTIONS = [
    "How do I create an agent?",
    "What API authentication is needed?",
    "How does call transfer work?",
    "How do I contact sales?",
    "How to set up appointments?"
  ];

  function getSuggestions() {
    var path = window.location.pathname.replace(/\/$/, "") || "/";
    // Try exact match first, then prefix match
    if (PAGE_SUGGESTIONS[path]) return PAGE_SUGGESTIONS[path];
    for (var key in PAGE_SUGGESTIONS) {
      if (path.indexOf(key) === 0) return PAGE_SUGGESTIONS[key];
    }
    return DEFAULT_SUGGESTIONS;
  }

  // ===== RELATED ARTICLES MAPPING =====
  var RELATED_ARTICLES = {
    "/": [
      { title: "Getting Started", href: "/guides/authentication" },
      { title: "Create Your First Agent", href: "/guides/agents" },
      { title: "API Reference", href: "/api-reference/introduction" }
    ],
    "/guides/authentication": [
      { title: "Dashboard Overview", href: "/guides/dashboard" },
      { title: "Create an Agent", href: "/guides/agents" },
      { title: "API Introduction", href: "/api-reference/introduction" }
    ],
    "/guides/agents": [
      { title: "Add Tools & Functions", href: "/guides/tools" },
      { title: "Call Sessions", href: "/guides/calls" },
      { title: "Agent API Reference", href: "/api-reference/agents/create" }
    ],
    "/guides/tools": [
      { title: "Agent Configuration", href: "/guides/agents" },
      { title: "Tool API Reference", href: "/api-reference/tools/create" },
      { title: "Inbound Calls", href: "/guides/inbound-calls" }
    ],
    "/guides/calls": [
      { title: "Analytics", href: "/guides/analytics" },
      { title: "Agent Configuration", href: "/guides/agents" },
      { title: "Inbound Calls", href: "/guides/inbound-calls" }
    ],
    "/guides/dashboard": [
      { title: "Analytics", href: "/guides/analytics" },
      { title: "Agents", href: "/guides/agents" },
      { title: "Billing", href: "/guides/billing" }
    ],
    "/guides/analytics": [
      { title: "Dashboard", href: "/guides/dashboard" },
      { title: "Call Sessions", href: "/guides/calls" },
      { title: "Billing & Costs", href: "/guides/billing" }
    ],
    "/guides/appointments": [
      { title: "Agent Configuration", href: "/guides/agents" },
      { title: "GHL Integration API", href: "/api-reference/ghl/list-appointments" },
      { title: "Cal.com Integration API", href: "/api-reference/calcom/oauth-connect" }
    ],
    "/guides/inbound-calls": [
      { title: "Phone Numbers", href: "/guides/phone-numbers" },
      { title: "Agent Configuration", href: "/guides/agents" },
      { title: "Call Sessions", href: "/guides/calls" }
    ],
    "/guides/phone-numbers": [
      { title: "Inbound Calls", href: "/guides/inbound-calls" },
      { title: "Billing", href: "/guides/billing" },
      { title: "Telephony API", href: "/api-reference/telephony/list-available-numbers" }
    ],
    "/guides/billing": [
      { title: "Phone Numbers", href: "/guides/phone-numbers" },
      { title: "Analytics", href: "/guides/analytics" },
      { title: "Settings", href: "/guides/settings" }
    ],
    "/guides/settings": [
      { title: "Authentication", href: "/guides/authentication" },
      { title: "Billing", href: "/guides/billing" },
      { title: "API Introduction", href: "/api-reference/introduction" }
    ],
    "/api-reference/introduction": [
      { title: "Authentication Guide", href: "/guides/authentication" },
      { title: "Agent API", href: "/api-reference/agents/create" },
      { title: "Tool API", href: "/api-reference/tools/create" }
    ]
  };

  function init() {
    // ===== SCROLL PROGRESS BAR =====
    var progressBar = document.createElement("div");
    progressBar.id = "agni-progress-bar";
    document.body.appendChild(progressBar);
    window.addEventListener("scroll", function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + "%" : "0%";
    });

    // ===== BUILD AI MODAL =====
    var ov = document.createElement("div");
    ov.id = "agni-search-overlay";

    var modal = document.createElement("div");
    modal.id = "agni-search-modal";

    // Header with title + clear button
    var header = document.createElement("div");
    header.className = "agni-modal-header";
    header.innerHTML = '<div class="agni-modal-title">\u{1F525} Agni AI</div>';
    var clearBtn = document.createElement("button");
    clearBtn.className = "agni-clear-btn";
    clearBtn.textContent = "New chat";
    clearBtn.addEventListener("click", function () {
      chatHistory = [];
      sessionStorage.removeItem("agni-chat");
      aiMessages.innerHTML = "";
      aiMessages.appendChild(buildWelcome());
      aiInput.focus();
    });
    header.appendChild(clearBtn);

    // AI panel
    var panelAi = document.createElement("div");
    panelAi.id = "agni-panel-ai";
    panelAi.className = "active";

    var aiMessages = document.createElement("div");
    aiMessages.id = "agni-ai-messages";

    // Welcome builder
    function buildWelcome() {
      var welcomeDiv = document.createElement("div");
      welcomeDiv.className = "agni-welcome";
      welcomeDiv.innerHTML = '<div class="agni-welcome-icon">\u{1F525}</div><h3>Agni AI Assistant</h3><p>Ask anything about Agni voice AI platform</p><div class="agni-suggestions"></div>';
      var sugDiv = welcomeDiv.querySelector(".agni-suggestions");
      getSuggestions().forEach(function (text) {
        var btn = document.createElement("button");
        btn.className = "agni-sug";
        btn.textContent = text;
        btn.addEventListener("click", function () { askAI(text); });
        sugDiv.appendChild(btn);
      });
      return welcomeDiv;
    }

    // Restore chat or show welcome
    var savedChat = [];
    try { savedChat = JSON.parse(sessionStorage.getItem("agni-chat") || "[]"); } catch (e) {}
    if (savedChat.length > 0) {
      savedChat.forEach(function (msg) {
        var content = msg.role === "user" ? escHtml(msg.content) : renderMarkdown(msg.content);
        addMessageToEl(aiMessages, msg.role === "user" ? "user" : "assistant", content);
      });
    } else {
      aiMessages.appendChild(buildWelcome());
    }

    // Textarea input (multi-line)
    var inputWrap = document.createElement("div");
    inputWrap.id = "agni-ai-input-wrap";
    var aiInput = document.createElement("textarea");
    aiInput.id = "agni-ai-input";
    aiInput.placeholder = "Ask Agni AI anything...";
    aiInput.rows = 1;
    aiInput.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });
    var sendBtn = document.createElement("button");
    sendBtn.id = "agni-ai-send";
    sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
    inputWrap.appendChild(aiInput);
    inputWrap.appendChild(sendBtn);

    panelAi.appendChild(aiMessages);
    panelAi.appendChild(inputWrap);

    // Footer
    var footer = document.createElement("div");
    footer.className = "agni-footer";
    footer.innerHTML = "<kbd>Esc</kbd>&nbsp;close&nbsp;\u2022&nbsp;<kbd>Ctrl+K</kbd>&nbsp;open";

    // Assemble
    modal.appendChild(header);
    modal.appendChild(panelAi);
    modal.appendChild(footer);
    ov.appendChild(modal);
    document.body.appendChild(ov);

    // ===== OPEN/CLOSE =====
    function openSearch() {
      ov.classList.add("active");
      aiInput.focus();
    }
    function closeSearch() { ov.classList.remove("active"); }

    // ===== AI CHAT =====
    var chatHistory = savedChat.slice();
    var sending = false;

    function addMessageToEl(container, role, content) {
      var row = document.createElement("div");
      row.className = "agni-msg-row " + role;
      var avatar = document.createElement("div");
      avatar.className = "agni-msg-avatar";
      avatar.textContent = role === "user" ? "Y" : "\u{1F525}";
      var contentWrap = document.createElement("div");
      contentWrap.className = "agni-msg-content";
      var label = document.createElement("div");
      label.className = "agni-msg-label";
      label.textContent = role === "user" ? "You" : "Agni AI";
      var body = document.createElement("div");
      body.className = "agni-msg-body";
      body.innerHTML = content;
      contentWrap.appendChild(label);
      contentWrap.appendChild(body);
      row.appendChild(avatar);
      row.appendChild(contentWrap);
      container.appendChild(row);
      container.scrollTop = container.scrollHeight;
      return row;
    }

    function addMessage(role, content) {
      return addMessageToEl(aiMessages, role, content);
    }

    function addThinking() {
      var el = document.createElement("div");
      el.className = "agni-msg-thinking";
      el.innerHTML = '<div class="agni-msg-avatar">\u{1F525}</div><div class="agni-dots"><span></span><span></span><span></span></div><span class="agni-think-text">Agni is thinking\u2026</span>';
      aiMessages.appendChild(el);
      aiMessages.scrollTop = aiMessages.scrollHeight;
      return el;
    }

    function saveChat() {
      try { sessionStorage.setItem("agni-chat", JSON.stringify(chatHistory.slice(-10))); } catch (e) {}
    }

    function askAI(query) {
      if (sending || !query || !query.trim()) return;

      // Remove welcome
      var w = aiMessages.querySelector(".agni-welcome");
      if (w) w.remove();

      sending = true;
      sendBtn.disabled = true;
      aiInput.value = "";
      aiInput.style.height = "auto";

      addMessage("user", escHtml(query));
      chatHistory.push({ role: "user", content: query });
      saveChat();

      var think = addThinking();

      // Progressive loading feedback
      var thinkText = think.querySelector(".agni-think-text");
      var t1 = setTimeout(function () { if (thinkText) thinkText.textContent = "Still working\u2026"; }, 3000);
      var t2 = setTimeout(function () { if (thinkText) thinkText.textContent = "Almost there\u2026"; }, 8000);

      fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query, history: chatHistory.slice(-4) })
      })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        clearTimeout(t1); clearTimeout(t2);
        if (think.parentNode) think.remove();
        var answer = data.answer || data.error || "No response.";
        addMessage("assistant", renderMarkdown(answer));
        chatHistory.push({ role: "assistant", content: answer });
        saveChat();
      })
      .catch(function (err) {
        clearTimeout(t1); clearTimeout(t2);
        if (think.parentNode) think.remove();
        addMessage("assistant", "<p>Sorry, couldn\u2019t connect to the AI. Please try again.</p>");
        console.error("[Agni AI]", err);
      })
      .finally(function () {
        sending = false;
        sendBtn.disabled = false;
        aiInput.focus();
      });
    }

    sendBtn.addEventListener("click", function () { askAI(aiInput.value); });
    aiInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAI(aiInput.value); }
    });

    // ===== INTERCEPT MINTLIFY SEARCH =====
    function isSearch(el) {
      if (!el) return false;
      // Never intercept elements inside the API playground or main content
      if (el.closest && (el.closest('[class*="playground"]') || el.closest('[class*="Playground"]') || el.closest('[class*="openapi"]') || el.closest('[class*="OpenApi"]') || el.closest('[class*="RequestExample"]') || el.closest('[class*="request-example"]') || el.closest("article") || el.closest('[role="main"]'))) return false;
      if (el.id === "search-bar-entry" || el.id === "search-bar-entry-mobile") return true;
      if (el.closest && (el.closest("#search-bar-entry") || el.closest("#search-bar-entry-mobile") || el.closest("[data-search]") || el.closest('[class*="search-bar"]'))) return true;
      if (el.tagName === "INPUT" && el.placeholder && el.placeholder.toLowerCase().indexOf("search") !== -1) return true;
      return false;
    }

    ["click", "mousedown", "focus"].forEach(function (evt) {
      document.addEventListener(evt, function (e) {
        if (isSearch(e.target)) { e.preventDefault(); e.stopPropagation(); openSearch(); }
      }, true);
    });

    ov.addEventListener("click", function (e) { if (e.target === ov) closeSearch(); });

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); ov.classList.contains("active") ? closeSearch() : openSearch(); }
      if (e.key === "Escape" && ov.classList.contains("active")) { e.preventDefault(); closeSearch(); }
    });

    // ===== KILL MINTLIFY SEARCH DIALOGS (CSS handles this now) =====
    // Removed JS-based dialog killing — the CSS selectors for cmdk-dialog,
    // CommandMenu, search-dialog, SearchDialog are sufficient.
    // The old JS approach was breaking the mobile sidebar and API playground.

    // ===== BACK TO TOP BUTTON =====
    var btt = document.createElement("button");
    btt.id = "agni-back-to-top";
    btt.innerHTML = "\u2191";
    btt.title = "Back to top";
    document.body.appendChild(btt);
    btt.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    window.addEventListener("scroll", function () {
      btt.classList.toggle("visible", window.scrollY > 400);
    });

    // ===== READING TIME =====
    try {
      var article = document.querySelector("article") || document.querySelector('[role="main"]') || document.querySelector("main");
      if (article) {
        var wordCount = (article.textContent || "").trim().split(/\s+/).length;
        var minutes = Math.max(1, Math.ceil(wordCount / 200));
        // Find a good place to inject - look for the page title
        var titleEl = article.querySelector("h1");
        if (titleEl) {
          var rtSpan = document.createElement("span");
          rtSpan.className = "agni-reading-time";
          rtSpan.textContent = minutes + " min read";
          titleEl.parentNode.insertBefore(rtSpan, titleEl.nextSibling);
        }
      }
    } catch (e) { /* */ }

    // ===== RELATED ARTICLES =====
    try {
      var pagePath = window.location.pathname.replace(/\/$/, "") || "/";
      var related = RELATED_ARTICLES[pagePath];
      if (related && related.length > 0) {
        var articleEl = document.querySelector("article") || document.querySelector('[role="main"]') || document.querySelector("main");
        if (articleEl) {
          var relDiv = document.createElement("div");
          relDiv.className = "agni-related-articles";
          relDiv.innerHTML = "<h4>Related Articles</h4>";
          var relGrid = document.createElement("div");
          relGrid.className = "agni-related-grid";
          related.forEach(function (r) {
            var a = document.createElement("a");
            a.href = r.href;
            a.className = "agni-related-card";
            a.innerHTML = '<span class="agni-related-title">' + escHtml(r.title) + '</span><span class="agni-related-arrow">\u2192</span>';
            relGrid.appendChild(a);
          });
          relDiv.appendChild(relGrid);
          articleEl.appendChild(relDiv);
        }
      }
    } catch (e) { /* */ }

    // ===== REBRAND (safe — avoids React-managed nodes) =====
    var rebrandTimer = null;
    function rebrand() {
      try {
        // Only target the footer area and specific known Mintlify branding spots
        // Avoid walking the entire DOM which breaks React state
        document.querySelectorAll('a[href*="mintlify.com"]').forEach(function (a) {
          a.href = "https://ravan.ai";
          a.textContent = "Agni by Ravan.ai";
        });
        // Target only footer and nav areas for text replacement — never touch article/main content
        var safeAreas = document.querySelectorAll("footer, nav, [class*='footer'], [class*='Footer']");
        safeAreas.forEach(function (area) {
          var w = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
          while (w.nextNode()) {
            var n = w.currentNode;
            if (n.nodeValue && /mintlify/i.test(n.nodeValue)) {
              var replaced = n.nodeValue
                .replace(/Powered\s+by\s+mintlify/gi, "Agni by Ravan.ai")
                .replace(/Powered\s+by\s+Mintlify/gi, "Agni by Ravan.ai")
                .replace(/Built\s+with\s+Mintlify/gi, "Agni by Ravan.ai")
                .replace(/mintlify/gi, "Agni");
              if (replaced !== n.nodeValue) n.nodeValue = replaced;
            }
          }
        });
      } catch (e) { /* */ }
    }
    function debouncedRebrand() {
      if (rebrandTimer) clearTimeout(rebrandTimer);
      rebrandTimer = setTimeout(rebrand, 500);
    }
    rebrand();
    // Only observe direct children of body — not subtree — to avoid React conflicts
    var rObs = new MutationObserver(debouncedRebrand);
    rObs.observe(document.body, { childList: true, subtree: false });

    console.log("[Agni] v4 loaded");
  }

  // Run after hydration
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 1200); });
  } else {
    setTimeout(init, 1200);
  }
})();
