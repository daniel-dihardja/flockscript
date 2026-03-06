// ─── Uniform value types ────────────────────────────────────────────────────

export type UniformValue =
  | { type: "float"; value: number }
  | { type: "vec2"; value: [number, number] }
  | { type: "vec3"; value: [number, number, number] }
  | { type: "vec4"; value: [number, number, number, number] };

// ─── Device definitions ──────────────────────────────────────────────────────

/** A device that compiles and owns a GLSL shader program. */
export interface ShaderDeviceDef {
  id: string;
  type: "shader";
  params: {
    /** Named key from the built-in shader registry, or raw inline GLSL. */
    frag: string;
    /** Named key from the vertex registry. Defaults to the fullscreen-quad vert. */
    vert?: string;
    /** User-defined uniforms. u_resolution and u_time are injected automatically. */
    uniforms?: Record<string, UniformValue>;
  };
}

/**
 * A temporal feedback accumulator placed between a shader and a screen.
 *
 * Each frame it blends the incoming shader output with the accumulated
 * previous result using ping-pong framebuffers.  The shader signals *where*
 * to inject new content via its output alpha channel:
 *   alpha = 0  →  show accumulated prev (decayed)
 *   alpha = 1  →  inject new colour from this frame
 */
export interface FeedbackDeviceDef {
  id: string;
  type: "feedback";
  params?: {
    /** How much of the previous frame to retain (0–1). 1.0 = perfect freeze. @default 0.97 */
    decay?: number;
    /** Scales the shader alpha mask before blending. @default 1.0 */
    inject?: number;
    /** Horizontal UV scroll applied to the prev-frame lookup each step. @default 0 */
    scroll_x?: number;
    /** Vertical UV scroll applied to the prev-frame lookup each step. @default 0 */
    scroll_y?: number;
    /** Max UV displacement magnitude from noise-driven warp. @default 0 */
    warp?: number;
    /** Speed of the warp noise pattern evolution. @default 1.0 */
    warp_speed?: number;
    /** Soft-sample radius for the prev frame (0 = sharp). @default 0 */
    blur?: number;
  };
}

/** A device that owns the WebGL canvas and acts as the final visual sink. */
export interface ScreenDeviceDef {
  id: string;
  type: "screen";
  params?: {
    background?: string;
  };
}

export type DeviceDef = ShaderDeviceDef | FeedbackDeviceDef | ScreenDeviceDef;

// ─── Route definition ────────────────────────────────────────────────────────

export interface RouteDef {
  /** Source port, e.g. "plasma.out" */
  from: string;
  /** Destination port, e.g. "display.in" */
  to: string;
  signal: "visual";
}

// ─── Top-level patch ─────────────────────────────────────────────────────────

export interface VisualPatch {
  devices: DeviceDef[];
  routes: RouteDef[];
}

// ─── Route definition ────────────────────────────────────────────────────────

export interface RouteDef {
  /** Source port, e.g. "plasma.out" */
  from: string;
  /** Destination port, e.g. "display.in" */
  to: string;
  signal: "visual";
}

// ─── Top-level patch ─────────────────────────────────────────────────────────

export interface VisualPatch {
  devices: DeviceDef[];
  routes: RouteDef[];
}
