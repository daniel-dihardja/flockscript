import { ShaderDevice, FeedbackDevice, ScreenDevice } from "./devices";
import type {
  VisualPatch,
  ShaderDeviceDef,
  FeedbackDeviceDef,
  ScreenDeviceDef,
} from "./types";

// ─── Pipeline node types ─────────────────────────────────────────────────────

/** A node ready to execute in topological order each frame. */
type PipelineNode =
  | { kind: "shader"; device: ShaderDevice }
  | { kind: "feedback"; device: FeedbackDevice; inputId: string }
  | { kind: "screen"; device: ScreenDevice; inputId: string };

// ─── VisualEngine ─────────────────────────────────────────────────────────────

/**
 * Builds a compositing pipeline from a `VisualPatch` and drives the WebGL
 * render loop.
 *
 * ### Pipeline model
 * Devices are connected by routes (`device.out → device.in`) and executed in
 * topological order every frame:
 *
 * ```
 * ShaderDevice  →  [FeedbackDevice]  →  ScreenDevice
 * ```
 *
 * Each frame the engine passes a `WebGLTexture` "bus" between nodes:
 *  - `ShaderDevice`   renders into its own off-screen FBO → emits a texture.
 *  - `FeedbackDevice` blends the incoming texture with its ping-pong history
 *                     and emits the accumulated texture.
 *  - `ScreenDevice`   blits the final texture to the canvas.
 *
 * ### Usage
 * ```ts
 * const engine = new VisualEngine(canvasEl, patch);
 * engine.start();
 * // later…
 * engine.load(newPatch);  // hot-reload
 * engine.dispose();
 * ```
 */
export class VisualEngine {
  private gl: WebGLRenderingContext;
  private shaders = new Map<string, ShaderDevice>();
  private feedbacks = new Map<string, FeedbackDevice>();
  private screens = new Map<string, ScreenDevice>();
  private pipeline: PipelineNode[] = [];
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
   * the RAF loop.  All existing GPU resources are disposed first.
   */
  load(patch: VisualPatch): void {
    this._disposeDevices();
    this._buildGraph(patch);
  }

  // ── Graph construction ──────────────────────────────────────────────────────

  private _buildGraph(patch: VisualPatch): void {
    const gl = this.gl;

    // 1. Instantiate devices.
    for (const def of patch.devices) {
      if (def.type === "shader") {
        this.shaders.set(def.id, new ShaderDevice(gl, def as ShaderDeviceDef));
      } else if (def.type === "feedback") {
        this.feedbacks.set(
          def.id,
          new FeedbackDevice(gl, def as FeedbackDeviceDef),
        );
      } else if (def.type === "screen") {
        this.screens.set(def.id, new ScreenDevice(gl, def as ScreenDeviceDef));
      }
    }

    // 2. Build upstream edge map: destId → srcId.
    const upstream = new Map<string, string>();
    for (const route of patch.routes) {
      if (route.signal !== "visual") continue;
      const srcId = route.from.replace(/\.out$/, "");
      const dstId = route.to.replace(/\.in$/, "");
      upstream.set(dstId, srcId);
    }

    // 3. DFS from each screen device to build a topologically-sorted pipeline.
    const added = new Set<string>();

    const walk = (id: string): void => {
      if (added.has(id)) return;
      const inputId = upstream.get(id);
      if (inputId) walk(inputId); // recurse: add dependencies first
      added.add(id);

      if (this.shaders.has(id)) {
        this.pipeline.push({ kind: "shader", device: this.shaders.get(id)! });
      } else if (this.feedbacks.has(id)) {
        if (!inputId) {
          console.warn(`[VisualEngine] feedback "${id}" has no upstream route`);
          return;
        }
        this.pipeline.push({
          kind: "feedback",
          device: this.feedbacks.get(id)!,
          inputId,
        });
      } else if (this.screens.has(id)) {
        if (!inputId) {
          console.warn(`[VisualEngine] screen "${id}" has no upstream route`);
          return;
        }
        this.pipeline.push({
          kind: "screen",
          device: this.screens.get(id)!,
          inputId,
        });
      } else {
        console.warn(`[VisualEngine] Unknown device id "${id}"`);
      }
    };

    for (const screenId of this.screens.keys()) {
      walk(screenId);
    }
  }

  // ── Render loop ──────────────────────────────────────────────────────────────

  /** Start the render loop. */
  start(): void {
    this.startTime = performance.now();

    const loop = () => {
      const time = (performance.now() - this.startTime) / 1000;

      // Resize canvas to match its CSS size (DPR-aware).
      const canvas = this.gl.canvas as HTMLCanvasElement;
      const dpr = window.devicePixelRatio ?? 1;
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // Texture bus: keyed by device id, carries WebGLTexture handles between nodes.
      const texBus = new Map<string, WebGLTexture>();

      for (const node of this.pipeline) {
        switch (node.kind) {
          case "shader": {
            const tex = node.device.renderToTexture(time, w, h);
            texBus.set(node.device.id, tex);
            break;
          }
          case "feedback": {
            const inputTex = texBus.get(node.inputId);
            if (!inputTex) {
              console.warn(
                `[VisualEngine] feedback "${node.device.id}": no texture for "${node.inputId}"`,
              );
              break;
            }
            const tex = node.device.process(inputTex, time, w, h);
            texBus.set(node.device.id, tex);
            break;
          }
          case "screen": {
            const tex = texBus.get(node.inputId);
            if (!tex) {
              console.warn(
                `[VisualEngine] screen "${node.device.id}": no texture for "${node.inputId}"`,
              );
              break;
            }
            node.device.drawTexture(tex, w, h);
            break;
          }
        }
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
    this._disposeDevices();
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private _disposeDevices(): void {
    for (const d of this.shaders.values()) d.dispose();
    for (const d of this.feedbacks.values()) d.dispose();
    for (const d of this.screens.values()) d.dispose();
    this.shaders.clear();
    this.feedbacks.clear();
    this.screens.clear();
    this.pipeline = [];
  }
}
