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

/** A device that owns a WebGL canvas and acts as the final visual sink. */
export interface ScreenDeviceDef {
  id: string;
  type: "screen";
  params?: {
    background?: string; /**
     * When true, the previous frame's output is captured in an off-screen
     * framebuffer and exposed as `uniform sampler2D u_prev_frame` to the
     * connected shader, enabling trail / feedback effects.
     */
    feedback?: boolean;
  };
}

export type DeviceDef = ShaderDeviceDef | ScreenDeviceDef;

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
