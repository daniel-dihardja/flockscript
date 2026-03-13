import type { UIMessage } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  if (!messages.length) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  const agentsUrl = process.env.AGENTS_URL;
  if (!agentsUrl) {
    return Response.json(
      { error: "AGENTS_URL is not configured" },
      { status: 500 },
    );
  }

  const serialized = messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join(" "),
  }));

  const agentRes = await fetch(`${agentsUrl}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: serialized }),
  });

  if (!agentRes.ok) {
    const detail = await agentRes.text();
    return Response.json({ error: detail }, { status: agentRes.status });
  }

  return new Response(agentRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
