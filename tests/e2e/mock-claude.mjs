// A stand-in for the Claude API used by the end-to-end tests (no real calls, no cost).
// It answers recommendation requests with a valid structured reply that picks the first
// candidate for each open seat, and keeps the last request so tests can check what the
// app actually sent (for example that no real names leave the server).
import http from "node:http";

const port = Number(process.env.MOCK_CLAUDE_PORT ?? 3199);
let lastBody = null;

function reply(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "request-id": "req_mock" });
  res.end(JSON.stringify(body));
}

function recommendation(userText) {
  const facts = JSON.parse(userText.slice(userText.indexOf("{")));
  const used = new Set();
  const assignments = facts.open_seats.map((s) => {
    const pick = s.candidates.find((c) => !used.has(c.associate));
    used.add(pick?.associate);
    return { seat: s.seat, associate: pick?.associate ?? "ASSOC_99" };
  });
  const first = assignments[0]?.associate ?? "nobody";
  return {
    summary: `${first} is the clear choice for ${facts.client.client}.`,
    teams: [
      {
        assignments,
        fit_score: 91,
        rationale: `${first} has no PTO near go-live and plenty of capacity.`,
        factors: {
          pto: "No PTO near first input.",
          collisions: "No other first inputs nearby.",
          capacity: "Well under target.",
          capability: "Covers the client's needs.",
          time_zone: "Same time zone.",
        },
        risks: ["None significant."],
        confidence: "high",
      },
    ],
    cautions: [],
  };
}

function insight(userText) {
  const ids = [...userText.matchAll(/\[id (\d+)\]/g)].map((m) => Number(m[1]));
  return {
    summary: "Solid week; go-live prep is on track and confidence is growing.",
    action_items: [
      { text: "Share the tax setup checklist", owner: "associate", due_hint: "Friday" },
      { text: "Book a shadowing session on multi-state setup", owner: "me", due_hint: "" },
    ],
    strengths: ["Organized go-live preparation"],
    weak_points: ["Waits too long to escalate blockers"],
    skills: [{ skill: "Multi-state tax setup", capability: "Multi-State" }],
    themes: ["go-live prep", "confidence"],
    morale: { level: "positive", reason: "Upbeat about the new client." },
    follow_ups: ids.slice(0, 1).map((id) => ({ item_id: id, status: "done", evidence: "Mentioned it was finished." })),
  };
}

function trend() {
  return {
    overview: "Steady progress across recent 1:1s with growing confidence on go-lives.",
    recurring_themes: [{ theme: "Go-live prep", detail: "Comes up in most meetings." }],
    skill_growth: ["Multi-state tax setup"],
    persistent_weak_points: ["Escalating blockers early"],
    morale_trajectory: { direction: "improving", detail: "More upbeat in each meeting." },
    follow_through: "Most agreed items get done on time.",
    talking_points: ["Agree when to escalate a blocker", "Plan the next shadowing session", "Check workload before the holidays"],
  };
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.method === "GET" && req.url === "/__last") return reply(res, 200, lastBody ?? {});
      if (req.method === "GET" && req.url?.startsWith("/v1/models/")) {
        const id = decodeURIComponent(req.url.split("/").pop());
        return reply(res, 200, { id, type: "model", display_name: "Mock Claude", created_at: "2026-01-01T00:00:00Z" });
      }
      if (req.method === "POST" && req.url?.startsWith("/v1/messages")) {
        lastBody = JSON.parse(raw);
        const user = lastBody.messages.find((m) => m.role === "user");
        const text = typeof user.content === "string" ? user.content : user.content.map((b) => b.text).join("");
        const system = Array.isArray(lastBody.system) ? lastBody.system.map((b) => b.text).join("") : String(lastBody.system ?? "");
        const answer = system.includes("see patterns across their 1:1 meetings")
          ? trend()
          : system.includes("get more out of their 1:1 meetings")
            ? insight(text)
            : recommendation(text);
        return reply(res, 200, {
          id: "msg_mock",
          type: "message",
          role: "assistant",
          model: lastBody.model,
          content: [{ type: "text", text: JSON.stringify(answer) }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1800, output_tokens: 400, cache_read_input_tokens: 0, cache_creation_input_tokens: 1500 },
        });
      }
      reply(res, 404, { type: "error", error: { type: "not_found_error", message: "Not found" } });
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`mock claude on ${port}`));
