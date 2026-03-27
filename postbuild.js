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

// Only inject external file references - no inline JS to avoid escaping issues
const INJECT_HEAD = '<link rel="stylesheet" href="/agni-overrides.css">\n<link href="/_pagefind/pagefind-ui.css" rel="stylesheet">\n';
const INJECT_BODY = '<script src="/_pagefind/pagefind-ui.js" defer></script>\n<script src="/agni-overrides.js" defer></script>\n';

function processHtml(filePath) {
  let html = fs.readFileSync(filePath, "utf8");

  // Fix meta tags
  html = html.replace(
    /<meta\s+name="generator"\s+content="Mintlify"\s*\/?>/gi,
    '<meta name="generator" content="Agni by Ravan.ai" />'
  );

  // Fix OG images
  html = html.replace(
    /https:\/\/mintlify\.mintlify\.app\/_next\/image[^"']*/g,
    "/images/hero-dark.png"
  );

  // Inject CSS in head, JS before body close
  if (html.includes("</head>")) {
    html = html.replace("</head>", INJECT_HEAD + "</head>");
  }
  if (html.includes("</body>")) {
    html = html.replace("</body>", INJECT_BODY + "</body>");
  }

  fs.writeFileSync(filePath, html, "utf8");
}

console.log("Agni Docs Post-Build Processing...");

// 1. Copy override files into out/
fs.copyFileSync(path.join(__dirname, "agni-overrides.js"), path.join(OUT_DIR, "agni-overrides.js"));
fs.copyFileSync(path.join(__dirname, "agni-overrides.css"), path.join(OUT_DIR, "agni-overrides.css"));
console.log("  Copied agni-overrides.js and agni-overrides.css");

// 2. Remove Node.js files that cause browser errors
var filesToRemove = [
  "serve.js", "build-openapi.js", "fix-newlines.js", "fix-tabs.js",
  "LICENSE", ".mintignore", "Start Docs.bat", "Start Docs.command", "test.html",
];
filesToRemove.forEach(function (f) {
  var p = path.join(OUT_DIR, f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log("  Removed: " + f); }
});

var snippetsDir = path.join(OUT_DIR, "snippets");
if (fs.existsSync(snippetsDir)) {
  fs.rmSync(snippetsDir, { recursive: true });
  console.log("  Removed: snippets/");
}

// 3. Process HTML files
var htmlFiles = findHtmlFiles(OUT_DIR);
console.log("  Processing " + htmlFiles.length + " HTML files...");
htmlFiles.forEach(function (file) { processHtml(file); });
console.log("  Done!");
