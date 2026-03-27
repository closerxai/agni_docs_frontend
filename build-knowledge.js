#!/usr/bin/env node
/**
 * Extracts all documentation content into a single knowledge base JSON
 * Used by the AI search API to answer questions about Agni docs
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT_FILE = path.join(ROOT, "api", "knowledge.json");

// Directories containing MDX docs
const DOC_DIRS = [".", "guides", "api-reference", "api-reference/agents", "api-reference/tools",
  "api-reference/widget-settings", "api-reference/telephony", "api-reference/appointments",
  "api-reference/ghl", "api-reference/calcom", "api-reference/health"];

function stripMdx(content) {
  // Remove import statements
  content = content.replace(/^import\s+.*$/gm, "");
  // Remove JSX components but keep text content
  content = content.replace(/<[A-Z][^>]*\/>/g, "");
  content = content.replace(/<[A-Z][^>]*>([\s\S]*?)<\/[A-Z][^>]*>/g, "$1");
  // Remove HTML tags but keep content
  content = content.replace(/<[^>]+>/g, "");
  // Remove frontmatter
  content = content.replace(/^---[\s\S]*?---/m, "");
  // Remove image references
  content = content.replace(/!\[.*?\]\(.*?\)/g, "");
  // Clean up links but keep text
  content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove excessive whitespace
  content = content.replace(/\n{3,}/g, "\n\n");
  return content.trim();
}

function extractTitle(content) {
  // Try frontmatter title
  const fmMatch = content.match(/title:\s*["']?([^"'\n]+)/);
  if (fmMatch) return fmMatch[1].trim();
  // Try first heading
  const hMatch = content.match(/^#\s+(.+)$/m);
  if (hMatch) return hMatch[1].trim();
  return null;
}

function extractDescription(content) {
  const match = content.match(/description:\s*["']?([^"'\n]+)/);
  return match ? match[1].trim() : null;
}

const knowledge = [];

for (const dir of DOC_DIRS) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) continue;

  const files = fs.readdirSync(fullDir).filter(f => f.endsWith(".mdx"));
  for (const file of files) {
    const filePath = path.join(fullDir, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const title = extractTitle(raw) || file.replace(".mdx", "");
    const description = extractDescription(raw) || "";
    const content = stripMdx(raw);

    // Build the URL path
    let urlPath = path.relative(ROOT, filePath).replace(/\\/g, "/").replace(".mdx", "");
    if (urlPath === "index") urlPath = "";

    knowledge.push({
      title,
      description,
      path: "/" + urlPath,
      content: content.substring(0, 2500), // Limit per-doc size for token efficiency
    });
  }
}

// Ensure api/ directory exists
const apiDir = path.join(ROOT, "api");
if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });

fs.writeFileSync(OUT_FILE, JSON.stringify(knowledge, null, 2), "utf8");
console.log(`Knowledge base built: ${knowledge.length} documents, ${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)}KB`);
