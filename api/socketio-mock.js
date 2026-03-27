// Mock Socket.io endpoint - returns error to stop Mintlify's polling completely
// Engine.IO error packet "4" with message tells the client to give up

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Return HTTP 400 with Engine.IO error - this tells the client
  // the server doesn't support websockets and to stop retrying
  res.setHeader("Content-Type", "application/json");
  return res.status(400).json({
    code: 0,
    message: "Transport unknown"
  });
};
