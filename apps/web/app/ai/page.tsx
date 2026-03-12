"use client";

import { useState } from "react";

import { AgentThread } from "./agent-thread";
import { JsonEditor } from "./json-editor";

export default function Page() {
  const [patch, setPatch] = useState<string>("{}");

  return (
    <div className="dark flex h-screen overflow-hidden bg-background text-foreground">
      <div className="w-1/3 border-r">
        <AgentThread onPatch={setPatch} />
      </div>
      <div className="w-2/3">
        <JsonEditor value={patch} onChange={setPatch} />
      </div>
    </div>
  );
}
