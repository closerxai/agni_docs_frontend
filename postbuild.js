#!/usr/bin/env node
/**
 * Post-build script for Agni Docs
 * - Removes Node.js files that cause browser errors
 * - Injects Pagefind search (after hydration, via runtime script)
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

// Runtime script injected before </body>
// Runs after Next.js hydration to avoid breaking React
const RUNTIME_SCRIPT = `
<link href="/_pagefind/pagefind-ui.css" rel="stylesheet">
<style>
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
.agni-search-hint{display:flex;align-items:center;gap:4px;font-size:11px;color:rgba(255,255,255,.3);padding:8px 16px 12px}
.agni-search-hint kbd{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:1px 6px;font-size:11px;font-family:inherit}
html.light #agni-search-modal,html:not(.dark) #agni-search-modal{background:#fff;border-color:rgba(255,69,0,.15)}
html.light #agni-search-modal .pagefind-ui,html:not(.dark) #agni-search-modal .pagefind-ui{--pagefind-ui-text:#1e1816;--pagefind-ui-background:#fff}
html.light #agni-search-modal .pagefind-ui .pagefind-ui__search-input,html:not(.dark) #agni-search-modal .pagefind-ui .pagefind-ui__search-input{background:rgba(0,0,0,.03);color:#1e1816}
html.light .agni-search-hint,html:not(.dark) .agni-search-hint{color:rgba(0,0,0,.3)}
html.light .agni-search-hint kbd,html:not(.dark) .agni-search-hint kbd{background:rgba(0,0,0,.06);border-color:rgba(0,0,0,.1)}
</style>
<script src="/_pagefind/pagefind-ui.js" defer></script>
<script>
(function(){
  function init(){
    var ov=document.createElement("div");
    ov.id="agni-search-overlay";
    ov.innerHTML='<div id="agni-search-modal"><div id="agni-search-container"></div><div class="agni-search-hint"><kbd>Esc</kbd>\\u00a0to close\\u00a0\\u2022\\u00a0<kbd>Ctrl</kbd>+<kbd>K</kbd>\\u00a0to search</div></div>';
    document.body.appendChild(ov);
    var si=null;
    function open(){
      if(!si&&typeof PagefindUI!=="undefined"){
        si=new PagefindUI({element:"#agni-search-container",showSubResults:true,showImages:false,placeholder:"Search Agni documentation...",autofocus:true,resetStyles:false});
      }
      ov.classList.add("active");
      setTimeout(function(){var i=ov.querySelector(".pagefind-ui__search-input");if(i){i.focus();i.select();}},150);
    }
    function close(){ov.classList.remove("active");}
    document.addEventListener("click",function(e){
      var t=e.target;
      if(t.closest("#search-bar-entry")||t.closest("#search-bar-entry-mobile")||t.closest("[data-search]")||t.closest('[class*="SearchEntry"]')||t.closest('[class*="search-bar"]')||(t.tagName==="INPUT"&&t.placeholder&&t.placeholder.toLowerCase().includes("search"))){
        e.preventDefault();e.stopPropagation();open();
      }
    },true);
    document.addEventListener("mousedown",function(e){
      var t=e.target;
      if(t.closest("#search-bar-entry")||t.closest("#search-bar-entry-mobile")||t.closest('[class*="search-bar"]')){
        e.preventDefault();e.stopPropagation();open();
      }
    },true);
    document.addEventListener("focus",function(e){
      var t=e.target;
      if(t.id==="search-bar-entry"||t.id==="search-bar-entry-mobile"){
        e.preventDefault();e.stopPropagation();open();
      }
    },true);
    ov.addEventListener("click",function(e){if(e.target===ov)close();});
    document.addEventListener("keydown",function(e){
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){e.preventDefault();ov.classList.contains("active")?close():open();}
      if(e.key==="Escape"&&ov.classList.contains("active")){e.preventDefault();close();}
    });

    // Replace Mintlify branding in DOM after hydration
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

  // Fix meta tags (safe, no hydration impact)
  html = html.replace(
    /<meta\s+name="generator"\s+content="Mintlify"\s*\/?>/gi,
    '<meta name="generator" content="Agni by Ravan.ai" />'
  );

  // Fix OG images pointing to mintlify.mintlify.app
  html = html.replace(
    /https:\/\/mintlify\.mintlify\.app\/_next\/image[^"']*/g,
    "/images/hero-dark.png"
  );

  // Inject runtime script before </body>
  if (html.includes("</body>")) {
    html = html.replace("</body>", RUNTIME_SCRIPT + "</body>");
  }

  fs.writeFileSync(filePath, html, "utf8");
}

// ===== MAIN =====
console.log("Agni Docs Post-Build Processing...\n");

// 1. Remove Node.js / dev files that cause browser errors
const filesToRemove = [
  "serve.js",
  "build-openapi.js",
  "fix-newlines.js",
  "fix-tabs.js",
  "LICENSE",
  ".mintignore",
  "Start Docs.bat",
  "Start Docs.command",
  "test.html",
];
for (const f of filesToRemove) {
  const p = path.join(OUT_DIR, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log("  Removed: " + f);
  }
}

// 2. Remove snippets dir (source files, not needed in output)
const snippetsDir = path.join(OUT_DIR, "snippets");
if (fs.existsSync(snippetsDir)) {
  fs.rmSync(snippetsDir, { recursive: true });
  console.log("  Removed: snippets/");
}

// 3. Process all HTML files
const htmlFiles = findHtmlFiles(OUT_DIR);
console.log("\n  Processing " + htmlFiles.length + " HTML files...");
for (const file of htmlFiles) {
  processHtml(file);
}
console.log("  Done: " + htmlFiles.length + " files processed");

console.log("\nPost-build complete!\n");
