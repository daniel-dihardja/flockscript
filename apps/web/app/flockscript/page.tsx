"use client";

import * as React from "react";
import { LiveEditor } from "@/components/editor/live-editor";
import { ShaderViewer } from "@/components/shader-viewer";

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
    <main className="flex min-h-screen w-full bg-neutral-900 text-slate-100">
      <div className="h-screen w-1/2">
        <LiveEditor />
      </div>
      <div className="h-screen w-1/2 bg-black">{/* <ShaderViewer /> */}</div>
    </main>
  );
}
