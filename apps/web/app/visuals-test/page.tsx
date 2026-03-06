"use client";

import * as React from "react";
import type { VisualPatch } from "@workspace/visuals";
import { PatchEditor } from "@/components/visuals/patch-editor";
import {
  VisualsCanvas,
  type VisualsCanvasHandle,
} from "@/components/visuals/visuals-canvas";
import { EXAMPLES } from "./patches/examples";

const initialPatch = EXAMPLES[0]!.patch;
const initialJson = JSON.stringify(initialPatch, null, 2);

export default function VisualsTestPage() {
  const canvasRef = React.useRef<VisualsCanvasHandle>(null);

  const handleRun = React.useCallback((parsed: unknown) => {
    canvasRef.current?.load(parsed as VisualPatch);
  }, []);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-black text-white">
      {/* Left column — JSON patch editor */}
      <div className="flex h-full w-1/3 flex-col border-r border-neutral-800">
        <PatchEditor
          initialValue={initialJson}
          onRun={handleRun}
          examples={EXAMPLES}
        />
      </div>

      {/* Right column — WebGL canvas */}
      <div className="flex h-full w-2/3 items-center justify-center bg-black">
        <VisualsCanvas ref={canvasRef} initialPatch={initialPatch} />
      </div>
    </main>
  );
}
