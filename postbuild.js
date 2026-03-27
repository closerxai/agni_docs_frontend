#!/usr/bin/env node
/**
 * Post-build script for Agni Docs
 * - Removes Node.js files that cause browser errors
 * - Injects Pagefind search + AI assistant (after hydration)
 * - Removes Mintlify branding
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "out");

function findHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "_pagefind") {
      results = results.concat(findHtmlFiles(fullPath));
    } else if (entry.name.endsWith(".html")) {
      results.push(fullPath);
    }
  }
  return results;
}

const RUNTIME_SCRIPT = `
<link href="/_pagefind/pagefind-ui.css" rel="stylesheet">
<style>
/* ===== SEARCH MODAL (Pagefind) ===== */
#agni-search-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:99999;justify-content:center;align-items:flex-start;padding-top:10vh}
#agni-search-overlay.active{display:flex}
#agni-search-modal{background:#0e0b0c;border:1px solid rgba(255,69,0,.2);border-radius:16px;width:90%;max-width:640px;max-height:70vh;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,.5),0 0 40px rgba(255,69,0,.1);animation:agni-in .2s ease-out}
@keyframes agni-in{from{opacity:0;transform:translateY(-20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
#agni-search-modal .pagefind-ui{--pagefind-ui-scale:1;--pagefind-ui-primary:#FF4500;--pagefind-ui-text:#e8e0de;--pagefind-ui-background:#0e0b0c;--pagefind-ui-border:rgba(255,69,0,.15);--pagefind-ui-tag:rgba(255,69,0,.1);--pagefind-ui-border-width:1px;--pagefind-ui-border-radius:12px;--pagefind-ui-font:inherit}
#agni-search-modal .pagefind-ui .pagefind-ui__search-input{font-size:16px;padding:16px 20px;background:rgba(255,255,255,.05);color:#e8e0de;border:none;border-bottom:1px solid rgba(255,69,0,.15);border-radius:16px 16px 0 0;width:100%;box-sizing:border-box}
#agni-search-modal .pagefind-ui .pagefind-ui__search-input::placeholder{color:rgba(255,255,255,.4)}
#agni-search-modal .pagefind-ui .pagefind-ui__search-input:focus{outline:none;box-shadow:none}
#agni-search-modal .pagefind-ui .pagefind-ui__search-clear{color:#FF4500}
#agni-search-modal .pagefind-ui .pagefind-ui__results-area{max-height:50vh;overflow-y:auto;padding:8px 16px 16px}
#agni-search-modal .pagefind-ui .pagefind-ui__result{padding:12px;border-radius:8px;border:none}
#agni-search-modal .pagefind-ui .pagefind-ui__result:hover{background:rgba(255,69,0,.05)}
#agni-search-modal .pagefind-ui .pagefind-ui__result-link{color:#FF7F50}
#agni-search-modal .pagefind-ui .pagefind-ui__result-excerpt{color:rgba(255,255,255,.6)}
#agni-search-modal .pagefind-ui .pagefind-ui__message{color:rgba(255,255,255,.5);padding:20px;text-align:center}
.agni-search-tabs{display:flex;border-bottom:1px solid rgba(255,69,0,.15);background:rgba(255,255,255,.02)}
.agni-search-tab{flex:1;padding:12px 16px;font-size:13px;font-weight:500;color:rgba(255,255,255,.5);background:none;border:none;cursor:pointer;transition:all .2s;border-bottom:2px solid transparent}
.agni-search-tab:hover{color:rgba(255,255,255,.8)}
.agni-search-tab.active{color:#FF4500;border-bottom-color:#FF4500}
.agni-search-hint{display:flex;align-items:center;gap:4px;font-size:11px;color:rgba(255,255,255,.3);padding:8px 16px 12px}
.agni-search-hint kbd{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:1px 6px;font-size:11px;font-family:inherit}
#agni-pagefind-wrap,#agni-ai-wrap{display:none}
#agni-pagefind-wrap.active,#agni-ai-wrap.active{display:block}

/* ===== AI CHAT ===== */
#agni-ai-wrap{padding:0;display:flex;flex-direction:column;max-height:55vh}
#agni-ai-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;min-height:120px}
.agni-ai-msg{padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.6;max-width:90%;word-wrap:break-word}
.agni-ai-msg.user{background:rgba(255,69,0,.15);color:#FF7F50;align-self:flex-end;border-bottom-right-radius:4px}
.agni-ai-msg.assistant{background:rgba(255,255,255,.06);color:#e8e0de;align-self:flex-start;border-bottom-left-radius:4px}
.agni-ai-msg.assistant a{color:#FF7F50;text-decoration:underline}
.agni-ai-msg.assistant code{background:rgba(255,255,255,.08);padding:1px 5px;border-radius:4px;font-size:13px}
.agni-ai-msg.assistant ul,.agni-ai-msg.assistant ol{margin:6px 0;padding-left:20px}
.agni-ai-msg.assistant li{margin:3px 0}
.agni-ai-msg.assistant strong{color:#fff}
.agni-ai-msg.thinking{color:rgba(255,255,255,.4);font-style:italic}
.agni-ai-msg.thinking::after{content:"";display:inline-block;width:12px;animation:dots 1.2s infinite}
@keyframes dots{0%{content:"."}33%{content:".."}66%{content:"..."}}
#agni-ai-input-wrap{display:flex;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,69,0,.15);background:rgba(0,0,0,.2)}
#agni-ai-input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,69,0,.15);border-radius:10px;padding:10px 14px;color:#e8e0de;font-size:14px;font-family:inherit;resize:none;outline:none}
#agni-ai-input::placeholder{color:rgba(255,255,255,.3)}
#agni-ai-input:focus{border-color:rgba(255,69,0,.4)}
#agni-ai-send{background:#FF4500;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
#agni-ai-send:hover{background:#e63e00;transform:scale(1.02)}
#agni-ai-send:disabled{opacity:.5;cursor:not-allowed;transform:none}
.agni-ai-welcome{text-align:center;padding:30px 20px;color:rgba(255,255,255,.4)}
.agni-ai-welcome h3{color:#FF4500;font-size:16px;margin:0 0 8px}
.agni-ai-welcome p{font-size:13px;margin:4px 0}
.agni-ai-suggestions{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:12px}
.agni-ai-suggestion{background:rgba(255,69,0,.08);border:1px solid rgba(255,69,0,.15);border-radius:8px;padding:6px 12px;font-size:12px;color:#FF7F50;cursor:pointer;transition:all .2s}
.agni-ai-suggestion:hover{background:rgba(255,69,0,.15);border-color:rgba(255,69,0,.3)}

/* Light mode */
html.light #agni-search-modal,html:not(.dark) #agni-search-modal{background:#fff;border-color:rgba(255,69,0,.15)}
html.light .agni-search-tab,html:not(.dark) .agni-search-tab{color:rgba(0,0,0,.5)}
html.light .agni-search-tab:hover,html:not(.dark) .agni-search-tab:hover{color:rgba(0,0,0,.8)}
html.light #agni-search-modal .pagefind-ui,html:not(.dark) #agni-search-modal .pagefind-ui{--pagefind-ui-text:#1e1816;--pagefind-ui-background:#fff}
html.light #agni-search-modal .pagefind-ui .pagefind-ui__search-input,html:not(.dark) #agni-search-modal .pagefind-ui .pagefind-ui__search-input{background:rgba(0,0,0,.03);color:#1e1816}
html.light .agni-ai-msg.assistant,html:not(.dark) .agni-ai-msg.assistant{background:rgba(0,0,0,.04);color:#1e1816}
html.light .agni-ai-msg.assistant strong,html:not(.dark) .agni-ai-msg.assistant strong{color:#000}
html.light #agni-ai-input,html:not(.dark) #agni-ai-input{background:rgba(0,0,0,.03);color:#1e1816}
html.light .agni-search-hint,html:not(.dark) .agni-search-hint{color:rgba(0,0,0,.3)}
html.light .agni-search-hint kbd,html:not(.dark) .agni-search-hint kbd{background:rgba(0,0,0,.06);border-color:rgba(0,0,0,.1)}
html.light .agni-ai-welcome,html:not(.dark) .agni-ai-welcome{color:rgba(0,0,0,.4)}
html.light .agni-ai-msg.thinking,html:not(.dark) .agni-ai-msg.thinking{color:rgba(0,0,0,.4)}
html.light #agni-ai-input-wrap,html:not(.dark) #agni-ai-input-wrap{background:rgba(0,0,0,.02)}
</style>
<script src="/_pagefind/pagefind-ui.js" defer></script>
<script>
(function(){
  var SUGGESTIONS=["How do I create an agent?","What API authentication is needed?","How does call transfer work?","What are the pricing details?","How to set up Cal.com integration?"];

  function init(){
    var ov=document.createElement("div");
    ov.id="agni-search-overlay";
    ov.innerHTML='<div id="agni-search-modal">'+
      '<div class="agni-search-tabs">'+
        '<button class="agni-search-tab active" data-tab="search">Search</button>'+
        '<button class="agni-search-tab" data-tab="ai">Ask AI</button>'+
      '</div>'+
      '<div id="agni-pagefind-wrap" class="active"><div id="agni-search-container"></div></div>'+
      '<div id="agni-ai-wrap">'+
        '<div id="agni-ai-messages">'+
          '<div class="agni-ai-welcome">'+
            '<h3>Agni AI Assistant</h3>'+
            '<p>Ask me anything about Agni voice AI platform</p>'+
            '<div class="agni-ai-suggestions"></div>'+
          '</div>'+
        '</div>'+
        '<div id="agni-ai-input-wrap">'+
          '<input id="agni-ai-input" placeholder="Ask about Agni..." autocomplete="off">'+
          '<button id="agni-ai-send">Send</button>'+
        '</div>'+
      '</div>'+
      '<div class="agni-search-hint"><kbd>Esc</kbd>\\u00a0to close\\u00a0\\u2022\\u00a0<kbd>Ctrl</kbd>+<kbd>K</kbd>\\u00a0to search</div>'+
    '</div>';
    document.body.appendChild(ov);

    // Add suggestion buttons
    var sugWrap=ov.querySelector(".agni-ai-suggestions");
    SUGGESTIONS.forEach(function(s){
      var btn=document.createElement("button");
      btn.className="agni-ai-suggestion";
      btn.textContent=s;
      btn.onclick=function(){askAI(s);};
      sugWrap.appendChild(btn);
    });

    // Tab switching
    var tabs=ov.querySelectorAll(".agni-search-tab");
    var pfWrap=document.getElementById("agni-pagefind-wrap");
    var aiWrap=document.getElementById("agni-ai-wrap");
    tabs.forEach(function(tab){
      tab.addEventListener("click",function(){
        tabs.forEach(function(t){t.classList.remove("active");});
        tab.classList.add("active");
        var which=tab.getAttribute("data-tab");
        pfWrap.classList.toggle("active",which==="search");
        aiWrap.classList.toggle("active",which==="ai");
        if(which==="search"){initPagefind();setTimeout(function(){var i=ov.querySelector(".pagefind-ui__search-input");if(i)i.focus();},100);}
        else{document.getElementById("agni-ai-input").focus();}
      });
    });

    // Pagefind
    var pfInit=false;
    function initPagefind(){
      if(pfInit||typeof PagefindUI==="undefined")return;
      pfInit=true;
      new PagefindUI({element:"#agni-search-container",showSubResults:true,showImages:false,placeholder:"Search Agni documentation...",autofocus:true,resetStyles:false});
    }

    function openSearch(tab){
      ov.classList.add("active");
      if(tab==="ai"){
        tabs[1].click();
      }else{
        tabs[0].click();
        initPagefind();
        setTimeout(function(){var i=ov.querySelector(".pagefind-ui__search-input");if(i){i.focus();i.select();}},150);
      }
    }
    function closeSearch(){ov.classList.remove("active");}

    // AI Chat
    var history=[];
    var sending=false;
    var messagesEl=document.getElementById("agni-ai-messages");
    var inputEl=document.getElementById("agni-ai-input");
    var sendBtn=document.getElementById("agni-ai-send");

    function addMsg(role,text){
      var el=document.createElement("div");
      el.className="agni-ai-msg "+role;
      el.innerHTML=formatMd(text);
      messagesEl.appendChild(el);
      messagesEl.scrollTop=messagesEl.scrollHeight;
      return el;
    }

    function formatMd(text){
      // Basic markdown: bold, code, links, lists
      return text
        .replace(/\\*\\*(.+?)\\*\\*/g,"<strong>$1</strong>")
        .replace(/\`([^\`]+)\`/g,"<code>$1</code>")
        .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g,'<a href="$2">$1</a>')
        .replace(/^[\\-\\*]\\s+(.+)$/gm,"<li>$1</li>")
        .replace(/(<li>.*<\\/li>)/gs,"<ul>$1</ul>")
        .replace(/\\n/g,"<br>");
    }

    function askAI(query){
      if(sending||!query.trim())return;
      // Remove welcome message
      var welcome=messagesEl.querySelector(".agni-ai-welcome");
      if(welcome)welcome.remove();

      sending=true;
      sendBtn.disabled=true;
      inputEl.value="";

      addMsg("user",query);
      history.push({role:"user",content:query});

      var thinkEl=document.createElement("div");
      thinkEl.className="agni-ai-msg thinking";
      thinkEl.textContent="Thinking";
      messagesEl.appendChild(thinkEl);
      messagesEl.scrollTop=messagesEl.scrollHeight;

      fetch("/api/ai-search",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({query:query,history:history.slice(-6)})
      })
      .then(function(r){return r.json();})
      .then(function(data){
        thinkEl.remove();
        if(data.error){
          addMsg("assistant","Sorry, I encountered an error: "+data.error);
        }else{
          addMsg("assistant",data.answer);
          history.push({role:"assistant",content:data.answer});
        }
      })
      .catch(function(err){
        thinkEl.remove();
        addMsg("assistant","Sorry, I couldn\\u2019t connect to the AI service. Please try again.");
      })
      .finally(function(){
        sending=false;
        sendBtn.disabled=false;
        inputEl.focus();
      });
    }

    sendBtn.addEventListener("click",function(){askAI(inputEl.value);});
    inputEl.addEventListener("keydown",function(e){
      if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();askAI(inputEl.value);}
    });

    // Intercept Mintlify search bars
    document.addEventListener("click",function(e){
      var t=e.target;
      if(t.closest("#search-bar-entry")||t.closest("#search-bar-entry-mobile")||t.closest("[data-search]")||t.closest('[class*="SearchEntry"]')||t.closest('[class*="search-bar"]')||(t.tagName==="INPUT"&&t.placeholder&&t.placeholder.toLowerCase().includes("search"))){
        e.preventDefault();e.stopPropagation();openSearch("search");
      }
    },true);
    document.addEventListener("mousedown",function(e){
      var t=e.target;
      if(t.closest("#search-bar-entry")||t.closest("#search-bar-entry-mobile")||t.closest('[class*="search-bar"]')){
        e.preventDefault();e.stopPropagation();openSearch("search");
      }
    },true);
    document.addEventListener("focus",function(e){
      var t=e.target;
      if(t.id==="search-bar-entry"||t.id==="search-bar-entry-mobile"){
        e.preventDefault();e.stopPropagation();openSearch("search");
      }
    },true);
    ov.addEventListener("click",function(e){if(e.target===ov)closeSearch();});
    document.addEventListener("keydown",function(e){
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){e.preventDefault();ov.classList.contains("active")?closeSearch():openSearch("search");}
      if(e.key==="Escape"&&ov.classList.contains("active")){e.preventDefault();closeSearch();}
    });

    // Rebrand Mintlify
    function rebrand(){
      var walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false);
      while(walk.nextNode()){
        var n=walk.currentNode;
        if(n.nodeValue&&/mintlify/i.test(n.nodeValue)){
          n.nodeValue=n.nodeValue.replace(/Powered\\s+by\\s+Mintlify/gi,"Agni by Ravan.ai").replace(/Built\\s+with\\s+Mintlify/gi,"Agni by Ravan.ai").replace(/Mintlify/gi,"Agni");
        }
      }
      document.querySelectorAll('a[href*="mintlify.com"]').forEach(function(a){
        a.href="https://ravan.ai";
        if(a.textContent&&/mintlify/i.test(a.textContent)){
          a.textContent=a.textContent.replace(/Powered\\s+by\\s+Mintlify/gi,"Agni by Ravan.ai").replace(/Mintlify/gi,"Ravan.ai");
        }
      });
    }
    rebrand();
    var obs=new MutationObserver(function(){rebrand();});
    obs.observe(document.body,{childList:true,subtree:true});
    setTimeout(function(){obs.disconnect();},10000);
  }

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){setTimeout(init,800);});}
  else{setTimeout(init,800);}
})();
</script>
`;

function processHtml(filePath) {
  let html = fs.readFileSync(filePath, "utf8");

  html = html.replace(
    /<meta\s+name="generator"\s+content="Mintlify"\s*\/?>/gi,
    '<meta name="generator" content="Agni by Ravan.ai" />'
  );

  html = html.replace(
    /https:\/\/mintlify\.mintlify\.app\/_next\/image[^"']*/g,
    "/images/hero-dark.png"
  );

  if (html.includes("</body>")) {
    html = html.replace("</body>", RUNTIME_SCRIPT + "</body>");
  }

  fs.writeFileSync(filePath, html, "utf8");
}

// ===== MAIN =====
console.log("Agni Docs Post-Build Processing...\\n");

const filesToRemove = [
  "serve.js", "build-openapi.js", "fix-newlines.js", "fix-tabs.js",
  "LICENSE", ".mintignore", "Start Docs.bat", "Start Docs.command", "test.html",
];
for (const f of filesToRemove) {
  const p = path.join(OUT_DIR, f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log("  Removed: " + f); }
}

const snippetsDir = path.join(OUT_DIR, "snippets");
if (fs.existsSync(snippetsDir)) {
  fs.rmSync(snippetsDir, { recursive: true });
  console.log("  Removed: snippets/");
}

const htmlFiles = findHtmlFiles(OUT_DIR);
console.log("\\n  Processing " + htmlFiles.length + " HTML files...");
for (const file of htmlFiles) { processHtml(file); }
console.log("  Done: " + htmlFiles.length + " files processed");
console.log("\\nPost-build complete!\\n");
