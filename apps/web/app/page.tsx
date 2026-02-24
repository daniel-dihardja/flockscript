 "use client";

import * as React from "react";
import { LiveEditor } from "@/components/editor/live-editor";

export default function Page() {
  const [engineStatus, setEngineStatus] = React.useState<
    "idle" | "initializing" | "running" | "error"
  >("idle");
  const [statusLabel, setStatusLabel] = React.useState("Audio engine idle");

  const initAudioEngine = async () => {
    if (engineStatus === "initializing") {
      return;
    }
    setEngineStatus("initializing");
    setStatusLabel("Initializing audio engine…");
    try {
      const { audioEngine } = await import("@workspace/audio");
      await audioEngine.init();
      const state = audioEngine.audioContext?.state ?? "unknown";
      setEngineStatus("running");
      setStatusLabel(`Audio engine ${state}`);
    } catch (error) {
      console.error("Failed to init audio engine", error);
      setEngineStatus("error");
      setStatusLabel("Audio engine failed");
    }
  };

  return (
    <main className="min-h-svh bg-neutral-900 px-6 py-8 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              FlockScript Live Editor
            </h1>
            <button
              type="button"
              className="rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-neutral-900 disabled:opacity-60"
              onClick={initAudioEngine}
              disabled={engineStatus === "initializing"}
            >
              {engineStatus === "running" ? "Engine running" : "Init audio engine"}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Evaluate blocks, lines, or selections with the keyboard. Blocks are
            separated by blank lines or --- markers.
          </p>
          <p
            className={`text-xs ${
              engineStatus === "running"
                ? "text-emerald-300"
                : engineStatus === "error"
                ? "text-rose-400"
                : "text-muted-foreground"
            }`}
          >
            {statusLabel}
          </p>
        </header>
        <section className="h-[70vh]">
          <LiveEditor />
        </section>
      </div>
    </main>
  );
}
