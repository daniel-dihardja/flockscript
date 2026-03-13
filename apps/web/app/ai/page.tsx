"use client";

import { AgentThread } from "./agent-thread";
import { JsonEditor } from "./json-editor";
import { PatchProvider } from "./patch-provider";

export default function Page() {
  return (
    <PatchProvider>
      <div className="dark flex h-screen overflow-hidden bg-background text-foreground">
        <div className="w-1/4 border-r">
          <AgentThread />
        </div>
        <div className="w-3/4">
          <JsonEditor />
        </div>
      </div>
    </PatchProvider>
  );
}
