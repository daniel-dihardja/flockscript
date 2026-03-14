"use client";

import { useState } from "react";

import { JsonEditor } from "./json-editor";
import { PatchFlow } from "./patch-flow";

type Tab = "json" | "flow";

export function EditorTabs() {
  const [tab, setTab] = useState<Tab>("flow");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b">
        <button
          type="button"
          onClick={() => setTab("flow")}
          className={`px-4 py-1.5 text-xs transition ${
            tab === "flow"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Flow
        </button>
        <button
          type="button"
          onClick={() => setTab("json")}
          className={`px-4 py-1.5 text-xs transition ${
            tab === "json"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          JSON
        </button>
      </div>

      {/* Keep both mounted so CodeMirror state is preserved on tab switch */}
      <div
        className={`flex-1 overflow-hidden ${tab === "json" ? "block" : "hidden"}`}
      >
        <JsonEditor />
      </div>
      <div
        className={`flex-1 overflow-hidden ${tab === "flow" ? "block" : "hidden"}`}
      >
        <PatchFlow />
      </div>
    </div>
  );
}
