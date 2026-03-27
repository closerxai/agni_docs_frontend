const knowledge = require("./knowledge.json");

// Build the full docs context (sent to Claude as system prompt)
const docsContext = knowledge
  .map((doc) => `## ${doc.title}\nPath: ${doc.path}\n${doc.description ? doc.description + "\n" : ""}\n${doc.content}`)
  .join("\n\n---\n\n");

const SYSTEM_PROMPT = `You are Agni AI Assistant — the helpful documentation assistant for Agni, a voice AI platform by Ravan.ai.

Your job is to answer user questions about the Agni platform accurately and concisely using ONLY the documentation provided below.

Rules:
- Answer based ONLY on the documentation content below. If the answer isn't in the docs, say so honestly.
- Be concise but thorough. Use bullet points and formatting for clarity.
- When referencing a feature or page, mention the relevant documentation path so users can navigate there.
- Use a friendly, professional tone.
- For API questions, include endpoint details, authentication requirements, and example usage when available.
- For feature questions, explain how to use the feature step by step.
- Do NOT make up information. Do NOT hallucinate features or endpoints.

---

AGNI DOCUMENTATION:

${docsContext}`;

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const { query, history = [] } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Missing 'query' field" });
  }

  // Build messages array with conversation history
  const messages = [];
  for (const msg of history.slice(-6)) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: "user", content: query });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      return res.status(502).json({ error: "AI service error" });
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text || "Sorry, I couldn't generate an answer.";

    return res.status(200).json({ answer });
  } catch (err) {
    console.error("AI search error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
