#!/usr/bin/env node
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

console.log("Agni Docs Post-Build Processing...");

// 1. Copy override files into out/
fs.copyFileSync(path.join(__dirname, "agni-overrides.js"), path.join(OUT_DIR, "agni-overrides.js"));
fs.copyFileSync(path.join(__dirname, "agni-overrides.css"), path.join(OUT_DIR, "agni-overrides.css"));
console.log("  Copied override files");

// 2. Create favicon.ico redirect page (actual favicon served from CDN via HTML meta)
var faviconDst = path.join(OUT_DIR, "favicon.ico");
if (!fs.existsSync(faviconDst)) {
  // Copy favicon.svg as fallback
  var faviconSrc = path.join(OUT_DIR, "favicon.svg");
  if (fs.existsSync(faviconSrc)) {
    fs.copyFileSync(faviconSrc, faviconDst);
    console.log("  Created favicon.ico fallback");
  }
}

// 3. Remove Node.js files that cause browser errors
["serve.js", "build-openapi.js", "fix-newlines.js", "fix-tabs.js",
 "LICENSE", ".mintignore", "Start Docs.bat", "Start Docs.command", "test.html"
].forEach(function (f) {
  var p = path.join(OUT_DIR, f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log("  Removed: " + f); }
});

var snippetsDir = path.join(OUT_DIR, "snippets");
if (fs.existsSync(snippetsDir)) {
  fs.rmSync(snippetsDir, { recursive: true });
  console.log("  Removed: snippets/");
}

// 4. Inject ONLY external file references into HTML - no content modifications
//    Append before </body> using simple string split to avoid breaking existing code
var htmlFiles = findHtmlFiles(OUT_DIR);
console.log("  Processing " + htmlFiles.length + " HTML files...");

var cssTag = '<link rel="stylesheet" href="/agni-overrides.css">';
var jsTag = '<script src="/agni-overrides.js" defer><\/script>';

htmlFiles.forEach(function (filePath) {
  var html = fs.readFileSync(filePath, "utf8");

  // Inject CSS right before first </head>
  var headIdx = html.indexOf("</head>");
  if (headIdx !== -1) {
    html = html.slice(0, headIdx) + cssTag + html.slice(headIdx);
  }

  // Inject JS right before last </body>
  var bodyIdx = html.lastIndexOf("</body>");
  if (bodyIdx !== -1) {
    html = html.slice(0, bodyIdx) + jsTag + html.slice(bodyIdx);
  }

  fs.writeFileSync(filePath, html, "utf8");
});

console.log("  Done!");
