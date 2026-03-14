"use client";

import { AgentThread } from "./agent-thread";
import { EditorToolbar } from "./editor-toolbar";
import { JsonEditor } from "./json-editor";
import { Oscilloscope } from "./oscilloscope";
import { PatchProvider } from "./patch-provider";

export default function Page() {
  return (
    <PatchProvider>
      <div className="dark flex h-screen overflow-hidden bg-background text-foreground">
        <div className="w-1/4 border-r">
          <AgentThread />
        </div>
        <div className="flex w-1/4 flex-col">
          <EditorToolbar />
          <div className="flex-1 overflow-hidden">
            <JsonEditor />
          </div>
        </div>
        <div className="w-2/4">
          <Oscilloscope />
        </div>
      </div>
    </PatchProvider>
  );
}
