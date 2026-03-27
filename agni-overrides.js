/*
 * Agni Docs - v3 Runtime Overrides
 * Search (Pagefind) + AI Assistant (Claude) + Rebrand
 */

// Suppress Mintlify errors
window.addEventListener("unhandledrejection", function (e) {
  if (e.reason && e.reason.message && /Connection closed|WebSocket/i.test(e.reason.message)) e.preventDefault();
});
window.addEventListener("error", function (e) {
  if (e.message && /Connection closed|WebSocket/i.test(e.message)) e.preventDefault();
});

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
        html.push("</code></pre>");
        inCode = false;
      } else {
        if (inList) { html.push(listType === "ul" ? "</ul>" : "</ol>"); inList = false; }
        var lang = line.replace(/^```/, "").trim();
        html.push('<pre><code class="lang-' + (lang || "text") + '">');
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

  var SUGGESTIONS = [
    "How do I create an agent?",
    "What API authentication is needed?",
    "How does call transfer work?",
    "What are the pricing details?",
    "How to set up appointments?"
  ];

  function init() {
    // ===== BUILD DOM =====
    var ov = document.createElement("div");
    ov.id = "agni-search-overlay";

    var modal = document.createElement("div");
    modal.id = "agni-search-modal";

    // Tabs
    var tabsDiv = document.createElement("div");
    tabsDiv.className = "agni-tabs";
    var searchTab = document.createElement("button");
    searchTab.className = "agni-tab active";
    searchTab.textContent = "Search";
    var aiTab = document.createElement("button");
    aiTab.className = "agni-tab";
    aiTab.textContent = "Ask AI";
    tabsDiv.appendChild(searchTab);
    tabsDiv.appendChild(aiTab);

    // Search panel
    var panelSearch = document.createElement("div");
    panelSearch.id = "agni-panel-search";
    panelSearch.className = "active";
    var pfContainer = document.createElement("div");
    pfContainer.id = "agni-search-container";
    panelSearch.appendChild(pfContainer);

    // AI panel
    var panelAi = document.createElement("div");
    panelAi.id = "agni-panel-ai";

    var aiMessages = document.createElement("div");
    aiMessages.id = "agni-ai-messages";

    // Welcome
    var welcomeDiv = document.createElement("div");
    welcomeDiv.className = "agni-welcome";
    welcomeDiv.innerHTML = '<div class="agni-welcome-icon">\u{1F525}</div><h3>Agni AI Assistant</h3><p>Ask anything about Agni voice AI platform</p><div class="agni-suggestions"></div>';
    aiMessages.appendChild(welcomeDiv);

    var sugDiv = welcomeDiv.querySelector(".agni-suggestions");
    SUGGESTIONS.forEach(function (text) {
      var btn = document.createElement("button");
      btn.className = "agni-sug";
      btn.textContent = text;
      btn.addEventListener("click", function () { askAI(text); });
      sugDiv.appendChild(btn);
    });

    // Input
    var inputWrap = document.createElement("div");
    inputWrap.id = "agni-ai-input-wrap";
    var aiInput = document.createElement("input");
    aiInput.id = "agni-ai-input";
    aiInput.placeholder = "Ask about Agni...";
    aiInput.autocomplete = "off";
    var sendBtn = document.createElement("button");
    sendBtn.id = "agni-ai-send";
    sendBtn.textContent = "Send";
    inputWrap.appendChild(aiInput);
    inputWrap.appendChild(sendBtn);

    panelAi.appendChild(aiMessages);
    panelAi.appendChild(inputWrap);

    // Footer
    var footer = document.createElement("div");
    footer.className = "agni-footer";
    footer.innerHTML = "<kbd>Esc</kbd>&nbsp;close&nbsp;\u2022&nbsp;<kbd>Ctrl+K</kbd>&nbsp;search";

    // Assemble
    modal.appendChild(tabsDiv);
    modal.appendChild(panelSearch);
    modal.appendChild(panelAi);
    modal.appendChild(footer);
    ov.appendChild(modal);
    document.body.appendChild(ov);

    // ===== TABS =====
    function switchTab(which) {
      searchTab.classList.toggle("active", which === "search");
      aiTab.classList.toggle("active", which === "ai");
      panelSearch.classList.toggle("active", which === "search");
      panelAi.classList.toggle("active", which === "ai");
      if (which === "search") {
        initPagefind();
        setTimeout(function () {
          var inp = pfContainer.querySelector(".pagefind-ui__search-input");
          if (inp) { inp.focus(); inp.select(); }
        }, 120);
      } else {
        aiInput.focus();
      }
    }
    searchTab.addEventListener("click", function () { switchTab("search"); });
    aiTab.addEventListener("click", function () { switchTab("ai"); });

    // ===== PAGEFIND =====
    var pfDone = false;
    var pfTries = 0;
    function initPagefind() {
      if (pfDone) return;
      if (typeof window.PagefindUI === "undefined") {
        if (++pfTries < 30) setTimeout(initPagefind, 300);
        return;
      }
      pfDone = true;
      try {
        new window.PagefindUI({
          element: "#agni-search-container",
          showSubResults: true,
          showImages: false,
          placeholder: "Search Agni docs...",
          autofocus: true,
          resetStyles: false
        });
      } catch (e) { console.error("[Agni] Pagefind error:", e); }
    }
    initPagefind(); // start immediately

    // ===== OPEN/CLOSE =====
    function openSearch(tab) {
      ov.classList.add("active");
      switchTab(tab || "search");
    }
    function closeSearch() { ov.classList.remove("active"); }

    // ===== AI CHAT =====
    var chatHistory = [];
    var sending = false;

    function addBubble(cls, content) {
      var el = document.createElement("div");
      el.className = cls;
      el.innerHTML = content;
      aiMessages.appendChild(el);
      aiMessages.scrollTop = aiMessages.scrollHeight;
      return el;
    }

    function askAI(query) {
      if (sending || !query || !query.trim()) return;

      // Remove welcome
      var w = aiMessages.querySelector(".agni-welcome");
      if (w) w.remove();

      sending = true;
      sendBtn.disabled = true;
      aiInput.value = "";

      addBubble("agni-msg-user", escHtml(query));
      chatHistory.push({ role: "user", content: query });

      // Thinking dots
      var think = addBubble("agni-msg-thinking", '<div class="agni-dots"><span></span><span></span><span></span></div>Thinking...');

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
        if (think.parentNode) think.remove();
        var answer = data.answer || data.error || "No response.";
        addBubble("agni-msg-ai", renderMarkdown(answer));
        chatHistory.push({ role: "assistant", content: answer });
      })
      .catch(function (err) {
        if (think.parentNode) think.remove();
        addBubble("agni-msg-ai", "<p>Sorry, couldn\u2019t connect to the AI. Please try again.</p>");
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
      if (el.id === "search-bar-entry" || el.id === "search-bar-entry-mobile") return true;
      if (el.closest && (el.closest("#search-bar-entry") || el.closest("#search-bar-entry-mobile") || el.closest("[data-search]") || el.closest('[class*="search-bar"]'))) return true;
      if (el.tagName === "INPUT" && el.placeholder && el.placeholder.toLowerCase().indexOf("search") !== -1) return true;
      return false;
    }

    ["click", "mousedown", "focus"].forEach(function (evt) {
      document.addEventListener(evt, function (e) {
        if (isSearch(e.target)) { e.preventDefault(); e.stopPropagation(); openSearch("search"); }
      }, true);
    });

    ov.addEventListener("click", function (e) { if (e.target === ov) closeSearch(); });

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); ov.classList.contains("active") ? closeSearch() : openSearch("search"); }
      if (e.key === "Escape" && ov.classList.contains("active")) { e.preventDefault(); closeSearch(); }
    });

    // ===== KILL MINTLIFY DIALOGS =====
    function killDialogs() {
      document.querySelectorAll("[data-radix-portal]").forEach(function (el) {
        if (!el.closest("#agni-search-overlay")) el.style.display = "none";
      });
    }
    var dObs = new MutationObserver(killDialogs);
    dObs.observe(document.body, { childList: true });

    // ===== REBRAND =====
    function rebrand() {
      try {
        // Replace text nodes
        var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
          var n = w.currentNode;
          if (n.nodeValue && /mintlify/i.test(n.nodeValue)) {
            n.nodeValue = n.nodeValue
              .replace(/Powered\s+by\s+mintlify/gi, "Agni by Ravan.ai")
              .replace(/Powered\s+by\s+Mintlify/gi, "Agni by Ravan.ai")
              .replace(/Built\s+with\s+Mintlify/gi, "Agni by Ravan.ai")
              .replace(/mintlify/gi, "Agni");
          }
        }
        // Replace links
        document.querySelectorAll('a[href*="mintlify.com"]').forEach(function (a) {
          a.href = "https://ravan.ai";
          a.textContent = "Agni by Ravan.ai";
        });
      } catch (e) { /* */ }
    }
    rebrand();
    var rObs = new MutationObserver(rebrand);
    rObs.observe(document.body, { childList: true, subtree: true });
    // Keep observing longer - Mintlify re-renders footer dynamically
    setTimeout(function () { rObs.disconnect(); }, 30000);

    console.log("[Agni] v3 loaded");
  }

  // Run after hydration
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 1200); });
  } else {
    setTimeout(init, 1200);
  }
})();
