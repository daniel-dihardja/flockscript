"use client";

import { usePatch, type EngineStatus } from "./patch-provider";

const statusDot: Record<EngineStatus, string> = {
  idle: "bg-zinc-500",
  initializing: "bg-yellow-400 animate-pulse",
  ready: "bg-green-400",
  error: "bg-red-500",
};

const statusLabel: Record<EngineStatus, string> = {
  idle: "Engine off",
  initializing: "Starting…",
  ready: "Engine ready",
  error: "Engine error",
};

export function EditorToolbar() {
  const {
    engineStatus,
    contextState,
    sampleRate,
    workletReady,
    initEngine,
    sendPatch,
    silence,
  } = usePatch();

  return (
    <div className="flex items-center gap-4 border-b bg-background px-4 py-2 text-xs text-muted-foreground">
      <button
        type="button"
        className="rounded border border-border px-3 py-1 text-xs transition hover:bg-muted"
        onClick={initEngine}
      >
        {engineStatus === "idle" ? "Start Engine" : "Resume"}
      </button>
      <button
        type="button"
        className="rounded border border-border px-3 py-1 text-xs transition hover:bg-muted"
        onClick={sendPatch}
      >
        Send Patch
      </button>
      <button
        type="button"
        className="rounded border border-border px-3 py-1 text-xs transition hover:bg-muted"
        onClick={silence}
      >
        Silence
      </button>

      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${statusDot[engineStatus]}`} />
        <span>{statusLabel[engineStatus]}</span>
      </div>

      {engineStatus === "ready" && (
        <>
          <span className="text-border">|</span>
          <span>
            Context:{" "}
            <span className="font-mono text-foreground">{contextState}</span>
          </span>
          <span>
            Sample rate:{" "}
            <span className="font-mono text-foreground">
              {sampleRate.toFixed(0)} Hz
            </span>
          </span>
          <span>
            Worklet:{" "}
            <span className="font-mono text-foreground">
              {workletReady ? "ready" : "loading"}
            </span>
          </span>
        </>
      )}
    </div>
  );
}
