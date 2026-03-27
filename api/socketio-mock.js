// Mock Socket.io endpoint to stop Mintlify's infinite polling
// Returns a valid Engine.IO handshake that tells the client to stop reconnecting

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  var url = req.url || "";

  // Engine.IO handshake response (EIO=4)
  // Return a valid handshake with very long pingTimeout so it doesn't retry often
  if (url.includes("EIO=4")) {
    res.setHeader("Content-Type", "text/plain; charset=UTF-8");
    // Engine.IO packet type 0 = open
    // sid: fake session id
    // pingInterval: 300000 (5 min)
    // pingTimeout: 600000 (10 min)
    // maxPayload: 1000000
    var handshake = JSON.stringify({
      sid: "agni-mock-" + Date.now(),
      upgrades: [],
      pingInterval: 300000,
      pingTimeout: 600000,
      maxPayload: 1000000
    });
    return res.status(200).end("0" + handshake);
  }

  return res.status(200).end("ok");
};
