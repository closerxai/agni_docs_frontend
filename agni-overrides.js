/*
 * Agni Docs - Runtime overrides
 * Search (Pagefind) + AI Assistant (Claude) + Mintlify rebrand
 */

// Suppress Mintlify connection errors
window.addEventListener("unhandledrejection", function (e) {
  if (e.reason && typeof e.reason === "object" && e.reason.message &&
      (e.reason.message.includes("Connection closed") || e.reason.message.includes("WebSocket"))) {
    e.preventDefault();
  }
});
window.addEventListener("error", function (e) {
  if (e.message && (e.message.includes("Connection closed") || e.message.includes("WebSocket"))) {
    e.preventDefault();
  }
});

(function () {
  "use strict";

  var SUGGESTIONS = [
    "How do I create an agent?",
    "What API authentication is needed?",
    "How does call transfer work?",
    "What are the pricing details?",
    "How to set up Cal.com integration?"
  ];

  function init() {
    // Build the modal HTML
    var ov = document.createElement("div");
    ov.id = "agni-search-overlay";

    var modal = document.createElement("div");
    modal.id = "agni-search-modal";

    // Tabs
    var tabsDiv = document.createElement("div");
    tabsDiv.className = "agni-search-tabs";

    var searchTab = document.createElement("button");
    searchTab.className = "agni-search-tab active";
    searchTab.setAttribute("data-tab", "search");
    searchTab.textContent = "Search";

    var aiTab = document.createElement("button");
    aiTab.className = "agni-search-tab";
    aiTab.setAttribute("data-tab", "ai");
    aiTab.textContent = "Ask AI";

    tabsDiv.appendChild(searchTab);
    tabsDiv.appendChild(aiTab);

    // Pagefind panel
    var pfWrap = document.createElement("div");
    pfWrap.id = "agni-pagefind-wrap";
    pfWrap.className = "active";
    var pfContainer = document.createElement("div");
    pfContainer.id = "agni-search-container";
    pfWrap.appendChild(pfContainer);

    // AI panel
    var aiWrap = document.createElement("div");
    aiWrap.id = "agni-ai-wrap";

    var aiMessages = document.createElement("div");
    aiMessages.id = "agni-ai-messages";

    // Welcome message
    var welcomeDiv = document.createElement("div");
    welcomeDiv.className = "agni-ai-welcome";
    var h3 = document.createElement("h3");
    h3.textContent = "Agni AI Assistant";
    var p = document.createElement("p");
    p.textContent = "Ask me anything about Agni voice AI platform";
    var sugDiv = document.createElement("div");
    sugDiv.className = "agni-ai-suggestions";
    welcomeDiv.appendChild(h3);
    welcomeDiv.appendChild(p);
    welcomeDiv.appendChild(sugDiv);
    aiMessages.appendChild(welcomeDiv);

    // Input area
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

    aiWrap.appendChild(aiMessages);
    aiWrap.appendChild(inputWrap);

    // Hint footer
    var hint = document.createElement("div");
    hint.className = "agni-search-hint";
    hint.innerHTML = "<kbd>Esc</kbd>&nbsp;to close&nbsp;\u2022&nbsp;<kbd>Ctrl</kbd>+<kbd>K</kbd>&nbsp;to search";

    // Assemble modal
    modal.appendChild(tabsDiv);
    modal.appendChild(pfWrap);
    modal.appendChild(aiWrap);
    modal.appendChild(hint);
    ov.appendChild(modal);
    document.body.appendChild(ov);

    // Add suggestion buttons
    SUGGESTIONS.forEach(function (text) {
      var btn = document.createElement("button");
      btn.className = "agni-ai-suggestion";
      btn.textContent = text;
      btn.addEventListener("click", function () { askAI(text); });
      sugDiv.appendChild(btn);
    });

    // ===== Tab switching =====
    function switchTab(which) {
      searchTab.classList.toggle("active", which === "search");
      aiTab.classList.toggle("active", which === "ai");
      pfWrap.classList.toggle("active", which === "search");
      aiWrap.classList.toggle("active", which === "ai");
      if (which === "search") {
        initPagefind();
        setTimeout(function () {
          var inp = pfWrap.querySelector(".pagefind-ui__search-input");
          if (inp) { inp.focus(); inp.select(); }
        }, 120);
      } else {
        aiInput.focus();
      }
    }

    searchTab.addEventListener("click", function () { switchTab("search"); });
    aiTab.addEventListener("click", function () { switchTab("ai"); });

    // ===== Pagefind =====
    var pfInit = false;
    function initPagefind() {
      if (pfInit) return;
      if (typeof window.PagefindUI === "undefined") {
        console.log("[Agni] Pagefind not loaded yet");
        return;
      }
      pfInit = true;
      new window.PagefindUI({
        element: "#agni-search-container",
        showSubResults: true,
        showImages: false,
        placeholder: "Search Agni documentation...",
        autofocus: true,
        resetStyles: false
      });
    }

    // ===== Open/Close =====
    function openSearch(tab) {
      ov.classList.add("active");
      switchTab(tab || "search");
    }
    function closeSearch() {
      ov.classList.remove("active");
    }

    // ===== AI Chat =====
    var chatHistory = [];
    var isSending = false;

    function createMsg(role, html) {
      var el = document.createElement("div");
      el.className = "agni-ai-msg " + role;
      el.innerHTML = html;
      aiMessages.appendChild(el);
      aiMessages.scrollTop = aiMessages.scrollHeight;
      return el;
    }

    function markdownToHtml(text) {
      if (!text) return "";
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/^[\-\*]\s+(.+)$/gm, "<li>$1</li>")
        .replace(/\n/g, "<br>");
    }

    function askAI(query) {
      if (isSending || !query || !query.trim()) return;

      // Remove welcome
      var welcome = aiMessages.querySelector(".agni-ai-welcome");
      if (welcome) welcome.remove();

      isSending = true;
      sendBtn.disabled = true;
      aiInput.value = "";

      // Show user message
      createMsg("user", markdownToHtml(query));
      chatHistory.push({ role: "user", content: query });

      // Show thinking indicator
      var thinkEl = createMsg("thinking", "Thinking...");

      // Call AI API
      fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query, history: chatHistory.slice(-6) })
      })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (thinkEl.parentNode) thinkEl.remove();
        if (data.error) {
          createMsg("assistant", "Sorry, I encountered an error: " + markdownToHtml(data.error));
        } else {
          var answer = data.answer || "No response received.";
          createMsg("assistant", markdownToHtml(answer));
          chatHistory.push({ role: "assistant", content: answer });
        }
      })
      .catch(function (err) {
        if (thinkEl.parentNode) thinkEl.remove();
        createMsg("assistant", "Sorry, couldn\u2019t connect to the AI service. Error: " + err.message);
        console.error("[Agni AI]", err);
      })
      .finally(function () {
        isSending = false;
        sendBtn.disabled = false;
        aiInput.focus();
      });
    }

    // Send button click
    sendBtn.addEventListener("click", function () {
      askAI(aiInput.value);
    });

    // Enter key to send
    aiInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        askAI(aiInput.value);
      }
    });

    // ===== Intercept Mintlify search bars =====
    function isSearchElement(el) {
      if (!el) return false;
      if (el.id === "search-bar-entry" || el.id === "search-bar-entry-mobile") return true;
      if (el.getAttribute && el.getAttribute("data-search") !== null) return true;
      var cls = el.className || "";
      if (typeof cls === "string" && (cls.indexOf("search-bar") !== -1 || cls.indexOf("SearchEntry") !== -1)) return true;
      if (el.tagName === "INPUT" && el.placeholder && el.placeholder.toLowerCase().indexOf("search") !== -1) return true;
      return false;
    }

    function interceptSearch(el) {
      if (isSearchElement(el) || (el && el.closest && (
        el.closest("#search-bar-entry") || el.closest("#search-bar-entry-mobile") ||
        el.closest("[data-search]") || el.closest('[class*="search-bar"]')
      ))) {
        return true;
      }
      return false;
    }

    document.addEventListener("click", function (e) {
      if (interceptSearch(e.target)) { e.preventDefault(); e.stopPropagation(); openSearch("search"); }
    }, true);

    document.addEventListener("mousedown", function (e) {
      if (interceptSearch(e.target)) { e.preventDefault(); e.stopPropagation(); openSearch("search"); }
    }, true);

    document.addEventListener("focus", function (e) {
      if (isSearchElement(e.target)) { e.preventDefault(); e.stopPropagation(); openSearch("search"); }
    }, true);

    // Close on overlay click
    ov.addEventListener("click", function (e) {
      if (e.target === ov) closeSearch();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        ov.classList.contains("active") ? closeSearch() : openSearch("search");
      }
      if (e.key === "Escape" && ov.classList.contains("active")) {
        e.preventDefault();
        closeSearch();
      }
    });

    // ===== Rebrand Mintlify =====
    function rebrand() {
      try {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        while (walker.nextNode()) {
          var node = walker.currentNode;
          if (node.nodeValue && /mintlify/i.test(node.nodeValue)) {
            node.nodeValue = node.nodeValue
              .replace(/Powered\s+by\s+Mintlify/gi, "Agni by Ravan.ai")
              .replace(/Built\s+with\s+Mintlify/gi, "Agni by Ravan.ai")
              .replace(/Mintlify/gi, "Agni");
          }
        }
        document.querySelectorAll('a[href*="mintlify.com"]').forEach(function (a) {
          a.href = "https://ravan.ai";
          if (a.textContent && /mintlify/i.test(a.textContent)) {
            a.textContent = a.textContent
              .replace(/Powered\s+by\s+Mintlify/gi, "Agni by Ravan.ai")
              .replace(/Mintlify/gi, "Ravan.ai");
          }
        });
      } catch (e) { /* ignore */ }
    }

    rebrand();
    var observer = new MutationObserver(rebrand);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { observer.disconnect(); }, 12000);

    console.log("[Agni] Overrides loaded successfully");
  }

  // Run after page hydration
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 1200); });
  } else {
    setTimeout(init, 1200);
  }
})();
