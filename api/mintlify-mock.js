// Mock handler for Mintlify internal API calls that the exported static site expects
// Returns safe empty responses so the Next.js app doesn't crash

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.url || "";

  // /_mintlify/api/user
  if (url.includes("/user")) {
    return res.status(200).json({ user: null, authenticated: false });
  }

  // /_mintlify/api/search
  if (url.includes("/search")) {
    return res.status(200).json({ results: [] });
  }

  // /_mintlify/api/assistant
  if (url.includes("/assistant")) {
    return res.status(200).json({ message: "" });
  }

  // Default empty response for any other mintlify API call
  return res.status(200).json({});
};
