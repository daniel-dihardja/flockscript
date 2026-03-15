"use client";

import { useState } from "react";

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
    initEngine,
    sendPatch,
    silence,
    startRecording,
    stopRecording,
  } = usePatch();

  const [isRecording, setIsRecording] = useState(false);

  const handleRec = async () => {
    if (!isRecording) {
      startRecording();
      setIsRecording(true);
    } else {
      try {
        const blob = await stopRecording();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recording-${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Recording failed", err);
      }
      setIsRecording(false);
    }
  };

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
      <button
        type="button"
        className={`rounded border px-3 py-1 text-xs transition ${
          isRecording
            ? "animate-pulse border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20"
            : "border-border hover:bg-muted"
        }`}
        onClick={handleRec}
      >
        {isRecording ? "● Stop" : "Rec"}
      </button>

      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${statusDot[engineStatus]}`} />
        <span>{statusLabel[engineStatus]}</span>
      </div>
    </div>
  );
}
