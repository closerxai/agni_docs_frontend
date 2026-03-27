const knowledge = require("./knowledge.json");

// Build compact docs context - trim each doc to save tokens
const docsContext = knowledge
  .map((doc) => {
    const content = doc.content.substring(0, 2000); // Limit each doc
    return `## ${doc.title}\nPath: ${doc.path}\n${content}`;
  })
  .join("\n\n---\n\n");

const SYSTEM_PROMPT = `You are Agni AI Assistant — the helpful documentation assistant for Agni, a voice AI platform by Ravan.ai.

Answer user questions about Agni accurately and concisely using the documentation below.

Rules:
- Answer based ONLY on the docs below. If not found, say so honestly.
- Be concise. Use bullet points for clarity.
- Friendly, professional tone.
- Do NOT make up information.
- At the END of every answer, add a "**Sources:**" line listing the doc pages you referenced as markdown links. Example: **Sources:** [Agents Guide](/guides/agents), [API Introduction](/api-reference/introduction)

AGNI DOCUMENTATION:

${docsContext}`;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured. Add ANTHROPIC_API_KEY in Vercel env vars." });
  }

  const { query, history = [] } = req.body || {};
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Missing query" });
  }

  // Keep only last 4 messages to avoid context overflow
  const messages = [];
  var recentHistory = history.slice(-4);
  for (var i = 0; i < recentHistory.length; i++) {
    var msg = recentHistory[i];
    if (msg && msg.role && msg.content) {
      messages.push({ role: msg.role, content: msg.content.substring(0, 1000) });
    }
  }
  messages.push({ role: "user", content: query.substring(0, 500) });

  // Try primary model, fallback to older model
  var models = ["claude-haiku-4-5-20251001", "claude-3-haiku-20240307"];

  for (var m = 0; m < models.length; m++) {
    try {
      var response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: models[m],
          max_tokens: 800,
          system: SYSTEM_PROMPT,
          messages: messages,
        }),
      });

      if (response.ok) {
        var data = await response.json();
        var answer = (data.content && data.content[0] && data.content[0].text) || "Sorry, I couldn't generate an answer.";
        return res.status(200).json({ answer: answer });
      }

      var errBody = await response.text();
      console.error("Anthropic API error (model=" + models[m] + "):", response.status, errBody);

      // If it's a model not found error, try next model
      if (response.status === 404 || response.status === 400) {
        continue;
      }

      // For rate limit or overloaded, return user-friendly message
      if (response.status === 429) {
        return res.status(200).json({ answer: "I'm getting a lot of questions right now. Please try again in a few seconds." });
      }
      if (response.status === 529) {
        return res.status(200).json({ answer: "The AI service is temporarily overloaded. Please try again in a moment." });
      }

      // Other errors - return details for debugging
      return res.status(200).json({ answer: "Sorry, the AI service returned an error (status " + response.status + "). Please try again." });

    } catch (err) {
      console.error("AI search error (model=" + models[m] + "):", err.message);
      if (m === models.length - 1) {
        return res.status(200).json({ answer: "Sorry, couldn't reach the AI service. Error: " + err.message });
      }
    }
  }

  return res.status(200).json({ answer: "Sorry, the AI service is unavailable right now. Please try again later." });
};
