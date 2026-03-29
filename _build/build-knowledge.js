#!/usr/bin/env node
/**
 * Extracts all documentation content into a single knowledge base JSON
 * Auto-discovers all directories containing MDX files
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(ROOT, "api", "knowledge.json");

// Auto-discover all directories containing .mdx files
function findMdxDirs(dir, results) {
  results = results || [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const hasMdx = entries.some(e => e.isFile() && e.name.endsWith(".mdx"));
  if (hasMdx) results.push(dir);
  for (const entry of entries) {
    if (entry.isDirectory() && !["node_modules", "out", ".git", ".claude", "_next", "api"].includes(entry.name)) {
      findMdxDirs(path.join(dir, entry.name), results);
    }
  }
  return results;
}

function stripMdx(content) {
  content = content.replace(/^import\s+.*$/gm, "");
  content = content.replace(/<[A-Z][^>]*\/>/g, "");
  content = content.replace(/<[A-Z][^>]*>([\s\S]*?)<\/[A-Z][^>]*>/g, "$1");
  content = content.replace(/<[^>]+>/g, "");
  content = content.replace(/^---[\s\S]*?---/m, "");
  content = content.replace(/!\[.*?\]\(.*?\)/g, "");
  content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  content = content.replace(/\n{3,}/g, "\n\n");
  return content.trim();
}

function extractTitle(content) {
  const fmMatch = content.match(/title:\s*["']?([^"'\n]+)/);
  if (fmMatch) return fmMatch[1].trim();
  const hMatch = content.match(/^#\s+(.+)$/m);
  if (hMatch) return hMatch[1].trim();
  return null;
}

function extractDescription(content) {
  const match = content.match(/description:\s*["']?([^"'\n]+)/);
  return match ? match[1].trim() : null;
}

const knowledge = [];
const mdxDirs = findMdxDirs(ROOT);

console.log("Scanning " + mdxDirs.length + " directories for MDX files...");

for (const dir of mdxDirs) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".mdx"));
  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const title = extractTitle(raw) || file.replace(".mdx", "");
    const description = extractDescription(raw) || "";
    const content = stripMdx(raw);

    let urlPath = path.relative(ROOT, filePath).replace(/\\/g, "/").replace(".mdx", "");
    if (urlPath === "index") urlPath = "";

    knowledge.push({
      title,
      description,
      path: "/" + urlPath,
      content: content.substring(0, 2500),
    });
  }
}

const apiDir = path.join(ROOT, "api");
if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });

fs.writeFileSync(OUT_FILE, JSON.stringify(knowledge, null, 2), "utf8");
console.log("Knowledge base built: " + knowledge.length + " documents, " + (fs.statSync(OUT_FILE).size / 1024).toFixed(1) + "KB");
