import { ShaderDevice, ScreenDevice } from "./devices";
import type { VisualPatch, ShaderDeviceDef, ScreenDeviceDef } from "./types";

interface DrawPair {
  shader: ShaderDevice;
  screen: ScreenDevice;
}

/**
 * The VisualEngine builds a device graph from a VisualPatch JSON descriptor
 * and drives the WebGL render loop.
 *
 * Usage:
 * ```ts
 * const engine = new VisualEngine(canvasEl, patch);
 * engine.start();
 * // later…
 * engine.dispose();
 * ```
 */
export class VisualEngine {
  private gl: WebGLRenderingContext;
  private shaders = new Map<string, ShaderDevice>();
  private screens = new Map<string, ScreenDevice>();
  private drawPairs: DrawPair[] = [];
  private animId = 0;
  private startTime = 0;

  constructor(canvas: HTMLCanvasElement, patch: VisualPatch) {
    const gl = canvas.getContext("webgl");
    if (!gl) throw new Error("WebGL not supported in this environment.");
    this.gl = gl;
    this._buildGraph(patch);
  }

  /**
   * Hot-reload a new patch without recreating the GL context or restarting
   * the RAF loop. Old GPU resources are disposed before the new graph is built.
   */
  load(patch: VisualPatch): void {
    for (const s of this.shaders.values()) s.dispose();
    for (const s of this.screens.values()) s.dispose();
    this.shaders.clear();
    this.screens.clear();
    this.drawPairs = [];
    this._buildGraph(patch);
  }

  private _buildGraph(patch: VisualPatch): void {
    const gl = this.gl;

    // ── Build devices ──────────────────────────────────────────────────────
    for (const def of patch.devices) {
      if (def.type === "shader") {
        this.shaders.set(def.id, new ShaderDevice(gl, def as ShaderDeviceDef));
      } else if (def.type === "screen") {
        this.screens.set(def.id, new ScreenDevice(gl, def as ScreenDeviceDef));
      }
    }

    // ── Resolve routes → draw pairs ────────────────────────────────────────
    for (const route of patch.routes) {
      if (route.signal !== "visual") continue;
      const shaderId = route.from.replace(/\.out$/, "");
      const screenId = route.to.replace(/\.in$/, "");
      const shader = this.shaders.get(shaderId);
      const screen = this.screens.get(screenId);
      if (shader && screen) {
        this.drawPairs.push({ shader, screen });
      } else {
        console.warn(
          `[VisualEngine] Could not resolve route: ${route.from} → ${route.to}`,
        );
      }
    }
  }

  /** Start the render loop. */
  start(): void {
    this.startTime = performance.now();

    const loop = () => {
      const time = (performance.now() - this.startTime) / 1000;
      for (const { shader, screen } of this.drawPairs) {
        screen.draw(shader, time);
      }
      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  /** Stop the render loop without releasing GPU resources. */
  stop(): void {
    cancelAnimationFrame(this.animId);
    this.animId = 0;
  }

  /** Stop the loop and release all GPU resources. */
  dispose(): void {
    this.stop();
    for (const s of this.shaders.values()) s.dispose();
    for (const s of this.screens.values()) s.dispose();
    this.shaders.clear();
    this.screens.clear();
    this.drawPairs = [];
  }
}
