"use client";

import { useEffect, useRef } from "react";
import { VisualEngine } from "@workspace/visuals";
import type { VisualPatch } from "@workspace/visuals";
import plasmaPatch from "./patches/plasma.json";

export default function VisualsTestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new VisualEngine(canvas, plasmaPatch as VisualPatch);
    engine.start();

    return () => {
      engine.dispose();
    };
  }, []);

  return (
    <main className="w-screen h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />
    </main>
  );
}
