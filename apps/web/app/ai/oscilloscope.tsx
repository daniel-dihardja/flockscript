"use client";

import { useEffect, useRef } from "react";

import { usePatch } from "./patch-provider";

export function Oscilloscope() {
  const { analyserNode } = usePatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  // Keep a ref in sync so the RAF loop always sees the latest analyserNode
  // without needing to restart the loop.
  useEffect(() => {
    analyserRef.current = analyserNode;
  }, [analyserNode]);

  // Single persistent RAF loop — starts on mount, never restarts.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      // Sync backing buffer to CSS layout size every frame (cheap comparison).
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      ctx.clearRect(0, 0, w, h);

      // Centre grid line — always visible as an idle indicator.
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const analyser = analyserRef.current;
      if (!analyser) return;

      const buffer = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buffer);

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const sliceWidth = w / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const sample = buffer[i] ?? 0;
        const y = ((1 - sample) / 2) * h;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // intentionally empty — loop runs for the full component lifetime

  return (
    <div className="flex h-full flex-col border-l">
      <div className="relative flex-1 bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
