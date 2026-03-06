import type { ScreenDeviceDef } from "../types";
import type { ShaderDevice } from "./shader";

// ─── Internal blit shader (passthrough texture → canvas) ────────────────────

const BLIT_VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const BLIT_FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  gl_FragColor = texture2D(u_tex, uv);
}
`;

function _compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? "Shader compile error");
  return s;
}

// ─── FBO helper ──────────────────────────────────────────────────────────────

interface FBOTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
}

/**
 * Owns the WebGL canvas context and the fullscreen-quad VBO.
 * Acts as the final visual sink: receives a ShaderDevice and draws one frame.
 *
 * When `feedback: true` is set in the device params, a ping-pong pair of
 * off-screen framebuffers is maintained. Each frame:
 *   1. The shader renders into the **write** FBO, with the **read** texture
 *      (previous frame) bound as `uniform sampler2D u_prev_frame`.
 *   2. The just-rendered write texture is blitted to the canvas via a minimal
 *      passthrough program.
 *   3. Read/write indices are swapped for the next frame.
 */
export class ScreenDevice {
  readonly id: string;
  private gl: WebGLRenderingContext;
  private quad: WebGLBuffer;
  private feedbackEnabled: boolean;

  // Ping-pong state — only allocated when feedbackEnabled = true
  private pingPong: [FBOTarget, FBOTarget] | null = null;
  private readIdx: 0 | 1 = 0;
  private fboWidth = 0;
  private fboHeight = 0;

  // Blit program — only compiled when feedbackEnabled = true
  private blitProgram: WebGLProgram | null = null;

  constructor(gl: WebGLRenderingContext, def: ScreenDeviceDef) {
    this.id = def.id;
    this.gl = gl;
    this.feedbackEnabled = def.params?.feedback ?? false;

    // Two triangles covering the full clip-space quad.
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.quad = buf;

    if (this.feedbackEnabled) {
      this.blitProgram = this._buildBlitProgram();
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _buildBlitProgram(): WebGLProgram {
    const gl = this.gl;
    const vert = _compile(gl, gl.VERTEX_SHADER, BLIT_VERT);
    const frag = _compile(gl, gl.FRAGMENT_SHADER, BLIT_FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog) ?? "Blit program link error");
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return prog;
  }

  private _makeFBOTarget(w: number, h: number): FBOTarget {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { fbo, tex };
  }

  private _destroyFBOTarget(t: FBOTarget): void {
    this.gl.deleteFramebuffer(t.fbo);
    this.gl.deleteTexture(t.tex);
  }

  private _resizePingPong(w: number, h: number): void {
    if (this.pingPong) {
      this._destroyFBOTarget(this.pingPong[0]);
      this._destroyFBOTarget(this.pingPong[1]);
    }
    this.pingPong = [this._makeFBOTarget(w, h), this._makeFBOTarget(w, h)];
    this.fboWidth = w;
    this.fboHeight = h;
    this.readIdx = 0;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * The texture representing the last completed frame.
   * Only non-null when `feedback: true` and at least one frame has been drawn.
   */
  get prevFrameTexture(): WebGLTexture | null {
    return this.pingPong ? this.pingPong[this.readIdx].tex : null;
  }

  /**
   * Resize the canvas to match its CSS size (respecting DPR), then draw
   * one frame using the supplied ShaderDevice's program.
   */
  draw(shader: ShaderDevice, time: number): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const dpr = window.devicePixelRatio ?? 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // ── Non-feedback path (identical to original behaviour) ────────────────
    if (!this.feedbackEnabled) {
      gl.viewport(0, 0, w, h);
      shader.applyUniforms(time, w, h, null);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      const posLoc = gl.getAttribLocation(shader.program, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return;
    }

    // ── Feedback path ──────────────────────────────────────────────────────
    // Allocate / resize ping-pong buffers whenever the canvas changes size.
    if (!this.pingPong || this.fboWidth !== w || this.fboHeight !== h) {
      this._resizePingPong(w, h);
    }

    const writeIdx = (1 - this.readIdx) as 0 | 1;
    const writeFBO = this.pingPong![writeIdx].fbo;
    const readTex = this.pingPong![this.readIdx].tex;

    // Pass 1 — render shader into the write FBO, sampling the previous frame.
    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
    gl.viewport(0, 0, w, h);
    shader.applyUniforms(time, w, h, readTex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const posLoc = gl.getAttribLocation(shader.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Swap: the just-rendered frame is now the "read" texture.
    this.readIdx = writeIdx;

    // Pass 2 — blit the freshly-rendered texture to the canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    const blitProg = this.blitProgram!;
    gl.useProgram(blitProg);
    // Use texture unit 1 for the blit to avoid stomping the shader's unit 0.
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.pingPong![this.readIdx].tex);
    const texLoc = gl.getUniformLocation(blitProg, "u_tex");
    if (texLoc !== null) gl.uniform1i(texLoc, 1);
    const resLoc = gl.getUniformLocation(blitProg, "u_resolution");
    if (resLoc !== null) gl.uniform2f(resLoc, w, h);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const blitPosLoc = gl.getAttribLocation(blitProg, "a_position");
    gl.enableVertexAttribArray(blitPosLoc);
    gl.vertexAttribPointer(blitPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // Restore default texture unit.
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.quad);
    if (this.pingPong) {
      this._destroyFBOTarget(this.pingPong[0]);
      this._destroyFBOTarget(this.pingPong[1]);
      this.pingPong = null;
    }
    if (this.blitProgram) {
      gl.deleteProgram(this.blitProgram);
      this.blitProgram = null;
    }
  }
}
