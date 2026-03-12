import { AgentThread } from "./agent-thread";
import { JsonEditor } from "./json-editor";

export default function Page() {
  return (
    <div className="dark flex h-screen overflow-hidden bg-background text-foreground">
      <div className="w-1/3 border-r">
        <AgentThread />
      </div>
      <div className="w-2/3">
        <JsonEditor />
      </div>
    </div>
  );
}
