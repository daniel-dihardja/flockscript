"use client";

import * as React from "react";
import { VisualEngine } from "@workspace/visuals";
import type { VisualPatch } from "@workspace/visuals";

export interface VisualsCanvasHandle {
  load(patch: VisualPatch): void;
}

interface VisualsCanvasProps {
  initialPatch: VisualPatch;
}

/**
 * Manages the WebGL canvas and VisualEngine lifecycle.
 * Exposes a `load()` imperative handle so a parent can hot-reload a new patch
 * without unmounting the component or losing the GL context.
 */
export const VisualsCanvas = React.forwardRef<
  VisualsCanvasHandle,
  VisualsCanvasProps
>(function VisualsCanvas({ initialPatch }, ref) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const engineRef = React.useRef<VisualEngine | null>(null);

  // Expose load() to the parent via ref.
  React.useImperativeHandle(ref, () => ({
    load(patch: VisualPatch) {
      engineRef.current?.load(patch);
    },
  }));

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new VisualEngine(canvas, initialPatch);
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // initialPatch is intentionally only consumed once — hot reloads go via load().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
});
