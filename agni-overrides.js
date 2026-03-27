/*
 * Agni Docs - Runtime overrides
 * Loaded after page hydration to add search, AI assistant, and rebrand
 */
(function () {
  var SUGGESTIONS = [
    "How do I create an agent?",
    "What API authentication is needed?",
    "How does call transfer work?",
    "What are the pricing details?",
    "How to set up Cal.com integration?",
  ];

  function init() {
    // Create search overlay
    var ov = document.createElement("div");
    ov.id = "agni-search-overlay";
    ov.innerHTML =
      '<div id="agni-search-modal">' +
      '<div class="agni-search-tabs">' +
      '<button class="agni-search-tab active" data-tab="search">Search</button>' +
      '<button class="agni-search-tab" data-tab="ai">Ask AI</button>' +
      "</div>" +
      '<div id="agni-pagefind-wrap" class="active"><div id="agni-search-container"></div></div>' +
      '<div id="agni-ai-wrap">' +
      '<div id="agni-ai-messages">' +
      '<div class="agni-ai-welcome">' +
      "<h3>Agni AI Assistant</h3>" +
      "<p>Ask me anything about Agni voice AI platform</p>" +
      '<div class="agni-ai-suggestions"></div>' +
      "</div>" +
      "</div>" +
      '<div id="agni-ai-input-wrap">' +
      '<input id="agni-ai-input" placeholder="Ask about Agni..." autocomplete="off">' +
      '<button id="agni-ai-send">Send</button>' +
      "</div>" +
      "</div>" +
      '<div class="agni-search-hint"><kbd>Esc</kbd>\u00a0to close\u00a0\u2022\u00a0<kbd>Ctrl</kbd>+<kbd>K</kbd>\u00a0to search</div>' +
      "</div>";
    document.body.appendChild(ov);

    // Suggestion buttons
    var sugWrap = ov.querySelector(".agni-ai-suggestions");
    SUGGESTIONS.forEach(function (s) {
      var btn = document.createElement("button");
      btn.className = "agni-ai-suggestion";
      btn.textContent = s;
      btn.onclick = function () {
        askAI(s);
      };
      sugWrap.appendChild(btn);
    });

    // Tab switching
    var tabs = ov.querySelectorAll(".agni-search-tab");
    var pfWrap = document.getElementById("agni-pagefind-wrap");
    var aiWrap = document.getElementById("agni-ai-wrap");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          t.classList.remove("active");
        });
        tab.classList.add("active");
        var which = tab.getAttribute("data-tab");
        pfWrap.classList.toggle("active", which === "search");
        aiWrap.classList.toggle("active", which === "ai");
        if (which === "search") {
          initPagefind();
          setTimeout(function () {
            var i = ov.querySelector(".pagefind-ui__search-input");
            if (i) i.focus();
          }, 100);
        } else {
          document.getElementById("agni-ai-input").focus();
        }
      });
    });

    // Pagefind
    var pfInit = false;
    function initPagefind() {
      if (pfInit || typeof PagefindUI === "undefined") return;
      pfInit = true;
      new PagefindUI({
        element: "#agni-search-container",
        showSubResults: true,
        showImages: false,
        placeholder: "Search Agni documentation...",
        autofocus: true,
        resetStyles: false,
      });
    }

    function openSearch(tab) {
      ov.classList.add("active");
      if (tab === "ai") {
        tabs[1].click();
      } else {
        tabs[0].click();
        initPagefind();
        setTimeout(function () {
          var i = ov.querySelector(".pagefind-ui__search-input");
          if (i) {
            i.focus();
            i.select();
          }
        }, 150);
      }
    }
    function closeSearch() {
      ov.classList.remove("active");
    }

    // AI Chat
    var history = [];
    var sending = false;
    var messagesEl = document.getElementById("agni-ai-messages");
    var inputEl = document.getElementById("agni-ai-input");
    var sendBtn = document.getElementById("agni-ai-send");

    function addMsg(role, text) {
      var el = document.createElement("div");
      el.className = "agni-ai-msg " + role;
      el.innerHTML = formatMd(text);
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    }

    function formatMd(text) {
      return text
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/^[\-\*]\s+(.+)$/gm, "<li>$1</li>")
        .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
        .replace(/\n/g, "<br>");
    }

    function askAI(query) {
      if (sending || !query.trim()) return;
      var welcome = messagesEl.querySelector(".agni-ai-welcome");
      if (welcome) welcome.remove();

      sending = true;
      sendBtn.disabled = true;
      inputEl.value = "";

      addMsg("user", query);
      history.push({ role: "user", content: query });

      var thinkEl = document.createElement("div");
      thinkEl.className = "agni-ai-msg thinking";
      thinkEl.textContent = "Thinking";
      messagesEl.appendChild(thinkEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query, history: history.slice(-6) }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          thinkEl.remove();
          if (data.error) {
            addMsg("assistant", "Sorry, I encountered an error: " + data.error);
          } else {
            addMsg("assistant", data.answer);
            history.push({ role: "assistant", content: data.answer });
          }
        })
        .catch(function () {
          thinkEl.remove();
          addMsg(
            "assistant",
            "Sorry, I couldn\u2019t connect to the AI service. Please try again."
          );
        })
        .finally(function () {
          sending = false;
          sendBtn.disabled = false;
          inputEl.focus();
        });
    }

    sendBtn.addEventListener("click", function () {
      askAI(inputEl.value);
    });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        askAI(inputEl.value);
      }
    });

    // Intercept Mintlify search bars
    document.addEventListener(
      "click",
      function (e) {
        var t = e.target;
        if (
          t.closest("#search-bar-entry") ||
          t.closest("#search-bar-entry-mobile") ||
          t.closest("[data-search]") ||
          t.closest('[class*="SearchEntry"]') ||
          t.closest('[class*="search-bar"]') ||
          (t.tagName === "INPUT" &&
            t.placeholder &&
            t.placeholder.toLowerCase().includes("search"))
        ) {
          e.preventDefault();
          e.stopPropagation();
          openSearch("search");
        }
      },
      true
    );
    document.addEventListener(
      "mousedown",
      function (e) {
        var t = e.target;
        if (
          t.closest("#search-bar-entry") ||
          t.closest("#search-bar-entry-mobile") ||
          t.closest('[class*="search-bar"]')
        ) {
          e.preventDefault();
          e.stopPropagation();
          openSearch("search");
        }
      },
      true
    );
    document.addEventListener(
      "focus",
      function (e) {
        var t = e.target;
        if (
          t.id === "search-bar-entry" ||
          t.id === "search-bar-entry-mobile"
        ) {
          e.preventDefault();
          e.stopPropagation();
          openSearch("search");
        }
      },
      true
    );
    ov.addEventListener("click", function (e) {
      if (e.target === ov) closeSearch();
    });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        ov.classList.contains("active")
          ? closeSearch()
          : openSearch("search");
      }
      if (e.key === "Escape" && ov.classList.contains("active")) {
        e.preventDefault();
        closeSearch();
      }
    });

    // Rebrand Mintlify
    function rebrand() {
      var walk = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      while (walk.nextNode()) {
        var n = walk.currentNode;
        if (n.nodeValue && /mintlify/i.test(n.nodeValue)) {
          n.nodeValue = n.nodeValue
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
    }
    rebrand();
    var obs = new MutationObserver(function () {
      rebrand();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () {
      obs.disconnect();
    }, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 1000);
    });
  } else {
    setTimeout(init, 1000);
  }
})();
