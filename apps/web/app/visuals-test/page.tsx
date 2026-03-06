"use client";

import * as React from "react";
import type { VisualPatch } from "@workspace/visuals";
import { PatchEditor } from "@/components/visuals/patch-editor";
import {
  VisualsCanvas,
  type VisualsCanvasHandle,
} from "@/components/visuals/visuals-canvas";
import plasmaPatch from "./patches/plasma.json";

const initialPatch = plasmaPatch as VisualPatch;
const initialJson = JSON.stringify(initialPatch, null, 2);

export default function VisualsTestPage() {
  const canvasRef = React.useRef<VisualsCanvasHandle>(null);

  const handleRun = React.useCallback((parsed: unknown) => {
    canvasRef.current?.load(parsed as VisualPatch);
  }, []);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-black text-white">
      {/* Left column — JSON patch editor */}
      <div className="flex h-full w-1/2 flex-col border-r border-neutral-800">
        <PatchEditor initialValue={initialJson} onRun={handleRun} />
      </div>

      {/* Right column — WebGL canvas */}
      <div className="flex h-full w-1/2 items-center justify-center bg-black">
        <VisualsCanvas ref={canvasRef} initialPatch={initialPatch} />
      </div>
    </main>
  );
}
