#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(PROJECT_ROOT, "out");
const BASE_URL = "https://agni-docs-frontend.vercel.app";

function findHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !["_pagefind", "_next", "favicons"].includes(entry.name)) {
      results = results.concat(findHtmlFiles(fullPath));
    } else if (entry.name.endsWith(".html")) {
      results.push(fullPath);
    }
  }
  return results;
}

function getPagePath(filePath) {
  var rel = path.relative(OUT_DIR, filePath).replace(/\\/g, "/");
  rel = rel.replace(/\/index\.html$/, "").replace(/\.html$/, "");
  if (rel === "index") rel = "";
  return "/" + rel;
}

function getPageType(pagePath) {
  if (pagePath === "/" || pagePath === "") return "home";
  if (pagePath.startsWith("/api-reference")) return "api";
  if (pagePath.startsWith("/guides")) return "guide";
  return "page";
}

// ===== SCAN MDX FILES FOR OPENAPI FRONTMATTER =====
function scanMdxEndpoints() {
  var map = {};
  var apiRefDir = path.join(PROJECT_ROOT, "api-reference");
  if (!fs.existsSync(apiRefDir)) return map;

  function scanDir(dir, prefix) {
    var entries = fs.readdirSync(dir, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, prefix + "/" + entry.name);
      } else if (entry.name.endsWith(".mdx")) {
        var pagePath = "/api-reference" + prefix + "/" + entry.name.replace(/\.mdx$/, "");
        try {
          var content = fs.readFileSync(fullPath, "utf8");
          // Extract openapi from YAML frontmatter
          var fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
          if (fmMatch) {
            var openapiMatch = fmMatch[1].match(/^openapi:\s*["']?(.+?)["']?\s*$/m);
            if (openapiMatch) {
              map[pagePath] = openapiMatch[1].trim();
            }
          }
        } catch (e) { /* skip */ }
      }
    }
  }

  scanDir(apiRefDir, "");
  return map;
}

console.log("Agni Docs Post-Build Processing...");

// 0. Scan MDX endpoints
var endpointMap = scanMdxEndpoints();
console.log("  Found " + Object.keys(endpointMap).length + " API endpoint pages");

// 1. Copy override files
fs.copyFileSync(path.join(PROJECT_ROOT, "agni-overrides.js"), path.join(OUT_DIR, "agni-overrides.js"));
fs.copyFileSync(path.join(PROJECT_ROOT, "agni-overrides.css"), path.join(OUT_DIR, "agni-overrides.css"));
// NOTE: agni-playground.js/css and agni-sdk.js/css are disabled.
// Mintlify has a built-in API playground ("Try it" button) that works natively.
// The custom playground was fighting with React hydration and causing crashes.
// Copy openapi.json so Mintlify's built-in playground can use it
var openapiSrc = path.join(PROJECT_ROOT, "openapi.json");
if (fs.existsSync(openapiSrc)) {
  fs.copyFileSync(openapiSrc, path.join(OUT_DIR, "openapi.json"));
  console.log("  Copied openapi.json");
}
console.log("  Copied override files");

// 2. Copy SEO files (robots.txt, llms.txt, llms-full.txt)
["robots.txt", "llms.txt", "llms-full.txt"].forEach(function (f) {
  var src = path.join(PROJECT_ROOT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(OUT_DIR, f));
    console.log("  Copied " + f);
  }
});

// 3. Favicon fallback
var faviconDst = path.join(OUT_DIR, "favicon.ico");
if (!fs.existsSync(faviconDst)) {
  var faviconSrc = path.join(OUT_DIR, "favicon.svg");
  if (fs.existsSync(faviconSrc)) {
    fs.copyFileSync(faviconSrc, faviconDst);
    console.log("  Created favicon.ico fallback");
  }
}

// 4. Remove Node.js files and disabled scripts from output
["serve.js", "build-openapi.js", "fix-newlines.js", "fix-tabs.js",
 "LICENSE", ".mintignore", "Start Docs.bat", "Start Docs.command", "test.html",
 "build-knowledge.js", "postbuild.js", "add-language-examples.js",
 "agni-playground.js", "agni-playground.css", "agni-sdk.js", "agni-sdk.css"
].forEach(function (f) {
  var p = path.join(OUT_DIR, f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log("  Removed: " + f); }
});

var snippetsDir = path.join(OUT_DIR, "snippets");
if (fs.existsSync(snippetsDir)) {
  fs.rmSync(snippetsDir, { recursive: true });
  console.log("  Removed: snippets/");
}

// 5. Process HTML files — inject SEO tags + override files + playground
var htmlFiles = findHtmlFiles(OUT_DIR);
console.log("  Processing " + htmlFiles.length + " HTML files for SEO...");

var sitemapEntries = [];

htmlFiles.forEach(function (filePath) {
  var html = fs.readFileSync(filePath, "utf8");
  var pagePath = getPagePath(filePath);
  var pageType = getPageType(pagePath);
  var fullUrl = BASE_URL + pagePath;

  // Collect for sitemap
  var priority = pageType === "home" ? "1.0" : pageType === "guide" ? "0.8" : pageType === "api" ? "0.7" : "0.5";
  sitemapEntries.push({ url: fullUrl, priority: priority });

  // Extract page title from HTML
  var titleMatch = html.match(/<title>([^<]+)<\/title>/);
  var pageTitle = titleMatch ? titleMatch[1].replace(/ - Agni$/, "") : "Agni Docs";

  // Extract description
  var descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  var pageDesc = descMatch ? descMatch[1] : "Agni voice AI documentation by Ravan.ai";

  // Build SEO injection for <head>
  var seoHead = '';

  // Canonical URL
  seoHead += '<link rel="canonical" href="' + fullUrl + '" />';

  // Robots meta
  seoHead += '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />';

  // JSON-LD Schema
  var schema;
  if (pageType === "home") {
    schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Agni by Ravan.ai",
      "url": BASE_URL,
      "logo": BASE_URL + "/logo/light.png",
      "description": "The world's most natural voice AI platform",
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "support@ravan.ai",
        "contactType": "Customer Support"
      },
      "sameAs": ["https://www.instagram.com/agnibyravan/"]
    };
  } else if (pageType === "guide") {
    schema = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": pageTitle,
      "description": pageDesc,
      "url": fullUrl,
      "publisher": { "@type": "Organization", "name": "Agni by Ravan.ai", "logo": { "@type": "ImageObject", "url": BASE_URL + "/logo/light.png" } },
      "mainEntityOfPage": fullUrl
    };
  } else if (pageType === "api") {
    schema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": pageTitle,
      "description": pageDesc,
      "url": fullUrl,
      "isPartOf": { "@type": "WebAPI", "name": "Agni API", "url": "https://api.ravan.ai" }
    };
  }

  if (schema) {
    seoHead += '<script type="application/ld+json">' + JSON.stringify(schema) + '</script>';
  }

  // Breadcrumb schema
  var breadcrumbs = pagePath.split("/").filter(Boolean);
  if (breadcrumbs.length > 0) {
    var bcItems = [{ "@type": "ListItem", "position": 1, "name": "Home", "item": BASE_URL }];
    var bcPath = "";
    breadcrumbs.forEach(function (segment, i) {
      bcPath += "/" + segment;
      bcItems.push({
        "@type": "ListItem",
        "position": i + 2,
        "name": segment.replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }),
        "item": BASE_URL + bcPath
      });
    });
    var bcSchema = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": bcItems };
    seoHead += '<script type="application/ld+json">' + JSON.stringify(bcSchema) + '</script>';
  }

  // Override CSS (playground/SDK disabled — Mintlify's built-in playground is used)
  seoHead += '<link rel="stylesheet" href="/agni-overrides.css">';

  // Inject into <head>
  var headIdx = html.indexOf("</head>");
  if (headIdx !== -1) {
    html = html.slice(0, headIdx) + seoHead + html.slice(headIdx);
  }

  // Inject JS before </body> (playground/SDK disabled — using Mintlify built-in)
  var jsTag = '<script src="/agni-overrides.js" defer><\/script>';
  var bodyIdx = html.lastIndexOf("</body>");
  if (bodyIdx !== -1) {
    html = html.slice(0, bodyIdx) + jsTag + html.slice(bodyIdx);
  }

  fs.writeFileSync(filePath, html, "utf8");
});

// 6. Generate sitemap.xml
var sitemapXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
sitemapEntries.forEach(function (entry) {
  sitemapXml += '  <url>\n';
  sitemapXml += '    <loc>' + entry.url + '</loc>\n';
  sitemapXml += '    <changefreq>weekly</changefreq>\n';
  sitemapXml += '    <priority>' + entry.priority + '</priority>\n';
  sitemapXml += '  </url>\n';
});
sitemapXml += '</urlset>';
fs.writeFileSync(path.join(OUT_DIR, "sitemap.xml"), sitemapXml, "utf8");
console.log("  Generated sitemap.xml with " + sitemapEntries.length + " URLs");

console.log("  Done! SEO optimization complete.");
