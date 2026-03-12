import type { UIMessage } from "ai";

export const maxDuration = 30;

interface AgentMessage {
  role: string;
  content: string;
}

interface AgentResponse {
  messages: AgentMessage[];
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  if (!lastUserMessage) {
    return Response.json({ error: "No user message found" }, { status: 400 });
  }

  const text = lastUserMessage.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join(" ");

  const agentsUrl = process.env.AGENTS_URL;
  if (!agentsUrl) {
    return Response.json(
      { error: "AGENTS_URL is not configured" },
      { status: 500 },
    );
  }

  const agentRes = await fetch(`${agentsUrl}/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }),
  });

  if (!agentRes.ok) {
    const detail = await agentRes.text();
    return Response.json({ error: detail }, { status: agentRes.status });
  }

  const data: AgentResponse = await agentRes.json();
  const aiMessage = data.messages.at(-1);

  return Response.json({ content: aiMessage?.content ?? "" });
}
