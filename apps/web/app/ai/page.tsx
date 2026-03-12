import { AgentThread } from "./agent-thread";

export default function Page() {
  return (
    <div className="dark flex h-screen overflow-hidden bg-background text-foreground">
      <div className="w-1/3 border-r">
        <AgentThread />
      </div>
      <div className="flex w-2/3 items-center justify-center text-muted-foreground">
        <p>Select an agent to get started</p>
      </div>
    </div>
  );
}
