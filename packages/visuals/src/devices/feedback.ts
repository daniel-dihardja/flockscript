import type { FeedbackDeviceDef } from "../types";
import {
  linkProgram,
  makeQuad,
  makeFBOTarget,
  destroyFBOTarget,
  drawQuad,
  type FBOTarget,
} from "../utils/gl";

// ─── Internal blend program ──────────────────────────────────────────────────

const FEEDBACK_VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

/**
 * Blend GLSL:
 *   - Sample the accumulated previous frame at a UV offset (scroll + noise warp)
 *     and multiply by `u_decay` to produce the faded history.
 *   - The current shader output is in `u_input`.  Its alpha channel acts as an
 *     injection mask: where alpha > 0, new colour replaces the history.
 *   - The final output has alpha = 1 (fully opaque composite).
 */
const FEEDBACK_FRAG = `
precision mediump float;

uniform sampler2D u_input;      // current shader frame
uniform sampler2D u_prev;       // accumulated previous frame
uniform vec2      u_resolution;
uniform float     u_time;
uniform float     u_decay;
uniform float     u_inject;
uniform float     u_scroll_x;
uniform float     u_scroll_y;
uniform float     u_warp;
uniform float     u_warp_speed;
uniform float     u_blur;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// 5-tap soft sample to soften the accumulated history.
vec4 samplePrev(vec2 uv) {
  vec2 px = vec2(u_blur) / u_resolution;
  vec4 c  = texture2D(u_prev, uv);
  c += texture2D(u_prev, uv + vec2( px.x,  0.0));
  c += texture2D(u_prev, uv + vec2(-px.x,  0.0));
  c += texture2D(u_prev, uv + vec2( 0.0,  px.y));
  c += texture2D(u_prev, uv + vec2( 0.0, -px.y));
  return c * 0.2;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // Noise-driven warp + directional scroll on the prev-frame UV lookup.
  float warpAngle  = hash(uv + u_time * u_warp_speed * 0.01) * 6.28318;
  vec2  warpOffset = vec2(cos(warpAngle), sin(warpAngle)) * u_warp;
  vec2  offset     = vec2(u_scroll_x, u_scroll_y) + warpOffset;

  // Decayed history.
  vec4 prev = samplePrev(uv + offset) * u_decay;

  // Current frame — alpha is used as the injection mask.
  vec4 inp  = texture2D(u_input, uv);
  float mask = inp.a * u_inject;

  // mix(prev, inp): where mask=0 → pure (decayed) history; mask=1 → pure input.
  gl_FragColor = vec4(mix(prev.rgb, inp.rgb, mask), 1.0);
}
`;

// ─── FeedbackDevice ──────────────────────────────────────────────────────────

/**
 * Temporal feedback accumulator — the core of Approach B's compositing graph.
 *
 * Sits between a `ShaderDevice` (or any texture-producing node) and a
 * `ScreenDevice`.  On every call to `process()` it:
 *   1. Blends the incoming texture with the accumulated previous result
 *      via its internal GLSL program (ping-pong FBOs).
 *   2. Returns the accumulated texture for the next pipeline stage.
 *
 * All blend parameters (decay, inject, scroll, warp, blur) live here, so any
 * ordinary shader gains feedback by inserting a FeedbackDevice in its route —
 * no shader changes required, as long as the shader uses alpha to signal where
 * to inject new content.
 */
export class FeedbackDevice {
  readonly id: string;
  private gl: WebGLRenderingContext;
  private quad: WebGLBuffer;
  private program: WebGLProgram;

  // Ping-pong state
  private pingPong: [FBOTarget, FBOTarget] | null = null;
  private readIdx: 0 | 1 = 0;
  private fboW = 0;
  private fboH = 0;

  // Blend params (from def.params, with defaults)
  private decay: number;
  private inject: number;
  private scrollX: number;
  private scrollY: number;
  private warp: number;
  private warpSpeed: number;
  private blur: number;

  constructor(gl: WebGLRenderingContext, def: FeedbackDeviceDef) {
    this.id = def.id;
    this.gl = gl;
    this.quad = makeQuad(gl);
    this.program = linkProgram(gl, FEEDBACK_VERT, FEEDBACK_FRAG);

    const p = def.params ?? {};
    this.decay = p.decay ?? 0.97;
    this.inject = p.inject ?? 1.0;
    this.scrollX = p.scroll_x ?? 0;
    this.scrollY = p.scroll_y ?? 0;
    this.warp = p.warp ?? 0;
    this.warpSpeed = p.warp_speed ?? 1.0;
    this.blur = p.blur ?? 0;
  }

  /**
   * Blend `inputTex` with the accumulated history and return the result texture.
   * The caller (VisualEngine) provides consistent `time`, `w`, `h` for this frame.
   */
  process(
    inputTex: WebGLTexture,
    time: number,
    w: number,
    h: number,
  ): WebGLTexture {
    const gl = this.gl;

    // Allocate / resize ping-pong pair when canvas dimensions change.
    if (!this.pingPong || this.fboW !== w || this.fboH !== h) {
      if (this.pingPong) {
        destroyFBOTarget(gl, this.pingPong[0]);
        destroyFBOTarget(gl, this.pingPong[1]);
      }
      this.pingPong = [makeFBOTarget(gl, w, h), makeFBOTarget(gl, w, h)];
      this.fboW = w;
      this.fboH = h;
      this.readIdx = 0;
    }

    const writeIdx = (1 - this.readIdx) as 0 | 1;
    const writeFBO = this.pingPong[writeIdx].fbo;
    const readTex = this.pingPong[this.readIdx].tex;

    // ── Blend pass into write FBO ────────────────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);

    // Texture unit 0 → u_input (current shader frame)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_input"), 0);

    // Texture unit 1 → u_prev (accumulated previous result)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_prev"), 1);

    // Uniform params
    const u = (n: string) => gl.getUniformLocation(this.program, n);
    const set1f = (n: string, v: number) => {
      const l = u(n);
      if (l !== null) gl.uniform1f(l, v);
    };
    const set2f = (n: string, x: number, y: number) => {
      const l = u(n);
      if (l !== null) gl.uniform2f(l, x, y);
    };
    set2f("u_resolution", w, h);
    set1f("u_time", time);
    set1f("u_decay", this.decay);
    set1f("u_inject", this.inject);
    set1f("u_scroll_x", this.scrollX);
    set1f("u_scroll_y", this.scrollY);
    set1f("u_warp", this.warp);
    set1f("u_warp_speed", this.warpSpeed);
    set1f("u_blur", this.blur);

    const posLoc = gl.getAttribLocation(this.program, "a_position");
    drawQuad(gl, this.quad, posLoc);

    // Swap: write becomes the new read for next frame.
    this.readIdx = writeIdx;

    // Cleanup: unbind FBO and textures, restore to unit 0.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return this.pingPong[this.readIdx].tex;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.quad);
    gl.deleteProgram(this.program);
    if (this.pingPong) {
      destroyFBOTarget(gl, this.pingPong[0]);
      destroyFBOTarget(gl, this.pingPong[1]);
      this.pingPong = null;
    }
  }
}
