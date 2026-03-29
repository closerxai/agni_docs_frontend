// Proxy handler for Mintlify API Playground "Send" requests
// Forwards the actual API call to api.ravan.ai and returns the response

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    var body = req.body;

    // Mintlify playground sends: { url, method, headers, body }
    if (!body || !body.url) {
      return res.status(400).json({ error: "Missing request URL" });
    }

    var targetUrl = body.url;
    var targetMethod = (body.method || "GET").toUpperCase();
    var targetHeaders = body.headers || {};

    // Build fetch options
    var fetchOpts = {
      method: targetMethod,
      headers: {}
    };

    // Forward all headers from the playground request
    Object.keys(targetHeaders).forEach(function (key) {
      // Skip host/origin headers
      if (["host", "origin", "referer", "content-length"].indexOf(key.toLowerCase()) === -1) {
        fetchOpts.headers[key] = targetHeaders[key];
      }
    });

    // Forward body for non-GET requests
    if (targetMethod !== "GET" && targetMethod !== "HEAD" && body.body) {
      fetchOpts.headers["Content-Type"] = fetchOpts.headers["Content-Type"] || "application/json";
      fetchOpts.body = typeof body.body === "string" ? body.body : JSON.stringify(body.body);
    }

    var response = await fetch(targetUrl, fetchOpts);
    var responseText = await response.text();

    // Try to parse as JSON
    var responseBody;
    try {
      responseBody = JSON.parse(responseText);
    } catch (e) {
      responseBody = responseText;
    }

    // Return in the format Mintlify playground expects
    var responseHeaders = {};
    response.headers.forEach(function (value, key) {
      responseHeaders[key] = value;
    });

    return res.status(200).json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      data: responseBody
    });
  } catch (err) {
    console.error("[request-proxy] Error:", err.message);
    return res.status(200).json({
      status: 500,
      statusText: "Proxy Error",
      headers: {},
      body: { error: err.message },
      data: { error: err.message }
    });
  }
};
