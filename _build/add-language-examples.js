#!/usr/bin/env node
/**
 * Adds Go, Ruby, PHP, Java, C# code examples to all API reference MDX files
 * by parsing the existing cURL example block.
 */

const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "api-reference");

function findMdxFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findMdxFiles(full));
    else if (entry.name.endsWith(".mdx")) results.push(full);
  }
  return results;
}

function parseCurl(curlBlock) {
  // Extract method, URL, headers, and body from cURL
  var method = "GET";
  var url = "";
  var headers = {};
  var body = null;

  var mMatch = curlBlock.match(/-X\s+(GET|POST|PUT|PATCH|DELETE)/);
  if (mMatch) method = mMatch[1];
  else if (curlBlock.includes("-d ") || curlBlock.includes("--data")) method = "POST";

  var urlMatch = curlBlock.match(/curl\s+(?:-X\s+\w+\s+)?["']?(https?:\/\/[^\s"'\\]+)/);
  if (!urlMatch) urlMatch = curlBlock.match(/(https?:\/\/[^\s"'\\]+)/);
  if (urlMatch) url = urlMatch[1];

  var headerRe = /-H\s+["']([^"']+)["']/g;
  var hm;
  while ((hm = headerRe.exec(curlBlock)) !== null) {
    var parts = hm[1].split(/:\s*/);
    if (parts.length >= 2) headers[parts[0]] = parts.slice(1).join(": ");
  }

  var bodyMatch = curlBlock.match(/-d\s+'([\s\S]*?)'/);
  if (!bodyMatch) bodyMatch = curlBlock.match(/-d\s+"([\s\S]*?)"/);
  if (bodyMatch) {
    try { body = JSON.parse(bodyMatch[1].replace(/\\\n/g, "")); } catch (e) { body = null; }
  }

  return { method, url, headers, body };
}

function generateGo(p) {
  var lines = ['package main\n\nimport (\n\t"fmt"\n\t"net/http"'];
  if (p.body) lines[0] += '\n\t"bytes"\n\t"encoding/json"';
  lines[0] += '\n\t"io"\n)\n\nfunc main() {';

  if (p.body) {
    lines.push('\tjsonBody, _ := json.Marshal(map[string]interface{}{');
    for (var k in p.body) {
      var v = p.body[k];
      if (typeof v === "string") lines.push('\t\t"' + k + '": "' + v + '",');
      else lines.push('\t\t"' + k + '": ' + JSON.stringify(v) + ',');
    }
    lines.push('\t})');
    lines.push('\treq, _ := http.NewRequest("' + p.method + '", "' + p.url + '", bytes.NewBuffer(jsonBody))');
  } else {
    lines.push('\treq, _ := http.NewRequest("' + p.method + '", "' + p.url + '", nil)');
  }

  for (var h in p.headers) {
    lines.push('\treq.Header.Set("' + h + '", "' + p.headers[h] + '")');
  }

  lines.push('\tclient := &http.Client{}');
  lines.push('\tresp, _ := client.Do(req)');
  lines.push('\tdefer resp.Body.Close()');
  lines.push('\tbody, _ := io.ReadAll(resp.Body)');
  lines.push('\tfmt.Println(string(body))');
  lines.push('}');
  return lines.join("\n");
}

function generateRuby(p) {
  var lines = ['require "net/http"', 'require "json"', 'require "uri"', ''];
  lines.push('uri = URI("' + p.url + '")');
  lines.push('http = Net::HTTP.new(uri.host, uri.port)');
  lines.push('http.use_ssl = true');
  lines.push('');

  var reqClass = { GET: "Get", POST: "Post", PUT: "Put", PATCH: "Patch", DELETE: "Delete" }[p.method] || "Get";
  lines.push('request = Net::HTTP::' + reqClass + '.new(uri)');

  for (var h in p.headers) {
    lines.push('request["' + h + '"] = "' + p.headers[h] + '"');
  }

  if (p.body) {
    lines.push('request.body = ' + JSON.stringify(p.body, null, 2).split("\n").join("\n"));
  }

  lines.push('');
  lines.push('response = http.request(request)');
  lines.push('puts response.body');
  return lines.join("\n");
}

function generatePhp(p) {
  var lines = ['<?php', ''];
  lines.push('$ch = curl_init("' + p.url + '");');
  lines.push('curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);');

  if (p.method !== "GET") {
    lines.push('curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "' + p.method + '");');
  }

  var headerList = [];
  for (var h in p.headers) {
    headerList.push("'" + h + ": " + p.headers[h] + "'");
  }
  if (headerList.length) {
    lines.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [' + headerList.join(", ") + ']);');
  }

  if (p.body) {
    lines.push('curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(' + phpArray(p.body) + '));');
  }

  lines.push('');
  lines.push('$response = curl_exec($ch);');
  lines.push('curl_close($ch);');
  lines.push('echo $response;');
  return lines.join("\n");
}

function phpArray(obj, indent) {
  indent = indent || 1;
  var pad = "\t".repeat(indent);
  var lines = ["["];
  for (var k in obj) {
    var v = obj[k];
    if (typeof v === "string") lines.push(pad + '"' + k + '" => "' + v + '",');
    else if (typeof v === "object" && v !== null) lines.push(pad + '"' + k + '" => ' + phpArray(v, indent + 1) + ',');
    else lines.push(pad + '"' + k + '" => ' + JSON.stringify(v) + ',');
  }
  lines.push("\t".repeat(indent - 1) + "]");
  return lines.join("\n");
}

function generateJava(p) {
  var lines = [];
  lines.push('import java.net.http.*;');
  lines.push('import java.net.URI;');
  lines.push('');
  lines.push('HttpClient client = HttpClient.newHttpClient();');

  if (p.body) {
    lines.push('String json = "' + JSON.stringify(p.body).replace(/"/g, '\\"') + '";');
    lines.push('HttpRequest request = HttpRequest.newBuilder()');
    lines.push('    .uri(URI.create("' + p.url + '"))');
    lines.push('    .method("' + p.method + '", HttpRequest.BodyPublishers.ofString(json))');
  } else {
    lines.push('HttpRequest request = HttpRequest.newBuilder()');
    lines.push('    .uri(URI.create("' + p.url + '"))');
    lines.push('    .method("' + p.method + '", HttpRequest.BodyPublishers.noBody())');
  }

  for (var h in p.headers) {
    lines.push('    .header("' + h + '", "' + p.headers[h] + '")');
  }
  lines.push('    .build();');
  lines.push('');
  lines.push('HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());');
  lines.push('System.out.println(response.body());');
  return lines.join("\n");
}

function generateCsharp(p) {
  var lines = [];
  lines.push('using var client = new HttpClient();');

  for (var h in p.headers) {
    if (h.toLowerCase() !== "content-type") {
      lines.push('client.DefaultRequestHeaders.Add("' + h + '", "' + p.headers[h] + '");');
    }
  }
  lines.push('');

  if (p.body) {
    lines.push('var json = @"' + JSON.stringify(p.body, null, 2).replace(/"/g, '""') + '";');
    lines.push('var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");');
    var methodMap = { POST: "PostAsync", PUT: "PutAsync", PATCH: "PatchAsync", DELETE: "DeleteAsync" };
    var csMethod = methodMap[p.method] || "PostAsync";
    lines.push('var response = await client.' + csMethod + '("' + p.url + '", content);');
  } else {
    if (p.method === "DELETE") {
      lines.push('var response = await client.DeleteAsync("' + p.url + '");');
    } else {
      lines.push('var response = await client.GetAsync("' + p.url + '");');
    }
  }

  lines.push('var body = await response.Content.ReadAsStringAsync();');
  lines.push('Console.WriteLine(body);');
  return lines.join("\n");
}

// ===== MAIN =====
var files = findMdxFiles(API_DIR);
var updated = 0;
var skipped = 0;

for (var file of files) {
  var content = fs.readFileSync(file, "utf8");

  // Normalize line endings
  content = content.replace(/\r\n/g, "\n");

  // Skip if already has Go examples
  if (content.includes("```go Go")) { skipped++; continue; }

  // Find the cURL block
  var curlMatch = content.match(/```bash\s+cURL\n([\s\S]*?)```/);
  if (!curlMatch) { skipped++; continue; }

  var parsed = parseCurl(curlMatch[1]);
  if (!parsed.url) { skipped++; continue; }

  // Generate new language examples
  var goCode = "```go Go\n" + generateGo(parsed) + "\n```";
  var rubyCode = "```ruby Ruby\n" + generateRuby(parsed) + "\n```";
  var phpCode = "```php PHP\n" + generatePhp(parsed) + "\n```";
  var javaCode = "```java Java\n" + generateJava(parsed) + "\n```";
  var csharpCode = "```csharp C#\n" + generateCsharp(parsed) + "\n```";

  var newExamples = "\n\n" + goCode + "\n\n" + rubyCode + "\n\n" + phpCode + "\n\n" + javaCode + "\n\n" + csharpCode;

  // Insert after the JavaScript block (last of the 3 existing examples)
  var jsBlockEnd = content.lastIndexOf("```\n\n</RequestExample>");
  if (jsBlockEnd === -1) jsBlockEnd = content.lastIndexOf("```\n</RequestExample>");

  if (jsBlockEnd !== -1) {
    // Find the end of the last ``` before </RequestExample>
    var insertPos = content.indexOf("```", content.lastIndexOf("```javascript"));
    if (insertPos === -1) insertPos = content.indexOf("```", content.lastIndexOf("```js"));
    // Actually, let's insert right before </RequestExample>
    var reqEndPos = content.indexOf("</RequestExample>");
    if (reqEndPos !== -1) {
      content = content.slice(0, reqEndPos) + newExamples + "\n\n" + content.slice(reqEndPos);
      fs.writeFileSync(file, content, "utf8");
      updated++;
    } else {
      skipped++;
    }
  } else {
    skipped++;
  }
}

console.log("Done! Updated: " + updated + ", Skipped: " + skipped);
