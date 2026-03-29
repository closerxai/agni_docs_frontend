// Mock handler for Mintlify internal API calls
// Returns safe responses so the Next.js app doesn't crash on Vercel

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");
  // Prevent caching of mock responses
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  var url = req.url || "";

  // /_mintlify/api/user - auth check
  if (url.includes("/user")) {
    return res.status(200).json({
      user: null,
      authenticated: false,
      authEnabled: false
    });
  }

  // /_mintlify/api/search
  if (url.includes("/search")) {
    return res.status(200).json({ results: [], totalCount: 0 });
  }

  // /_mintlify/api/assistant
  if (url.includes("/assistant")) {
    return res.status(200).json({ message: "", done: true });
  }

  // /_mintlify/api/revalidate
  if (url.includes("/revalidate")) {
    return res.status(200).json({ revalidated: true });
  }

  // /_mintlify/api/connect
  if (url.includes("/connect")) {
    return res.status(200).json({ ok: true });
  }

  // Default: return empty success
  return res.status(200).json({});
};
