import { FRAG_REGISTRY, VERT_REGISTRY } from "../shaders";
import type { ShaderDeviceDef, UniformValue } from "../types";
import {
  linkProgram,
  makeQuad,
  makeFBOTarget,
  destroyFBOTarget,
  drawQuad,
  type FBOTarget,
} from "../utils/gl";

/**
 * Compiles a GLSL program from the patch definition and renders each frame
 * into its own off-screen texture.
 *
 * The output texture is consumed by the next pipeline stage — either a
 * `FeedbackDevice` for temporal accumulation or a `ScreenDevice` directly.
 *
 * Named uniform keys resolved against the built-in registries; unknown strings
 * are treated as raw inline GLSL.
 */
export class ShaderDevice {
  readonly id: string;
  readonly program: WebGLProgram;
  private uniforms: Record<string, UniformValue>;
  private gl: WebGLRenderingContext;
  private quad: WebGLBuffer;

  // Off-screen render target — allocated lazily and resized on dimension change.
  private fboTarget: FBOTarget | null = null;
  private fboW = 0;
  private fboH = 0;

  constructor(gl: WebGLRenderingContext, def: ShaderDeviceDef) {
    this.id = def.id;
    this.gl = gl;
    this.uniforms = def.params.uniforms ?? {};
    this.quad = makeQuad(gl);

    const vertSrc = def.params.vert
      ? (VERT_REGISTRY[def.params.vert] ?? def.params.vert)
      : VERT_REGISTRY["default"]!;
    const fragSrc = FRAG_REGISTRY[def.params.frag] ?? def.params.frag;

    this.program = linkProgram(gl, vertSrc, fragSrc);
  }

  /**
   * Render one frame into the device's own off-screen texture and return it.
   * The VisualEngine passes a consistent `w`/`h` for all pipeline nodes in
   * this frame so FBO dimensions stay in sync.
   */
  renderToTexture(time: number, w: number, h: number): WebGLTexture {
    const gl = this.gl;

    // Reallocate FBO when dimensions change.
    if (!this.fboTarget || this.fboW !== w || this.fboH !== h) {
      if (this.fboTarget) destroyFBOTarget(gl, this.fboTarget);
      this.fboTarget = makeFBOTarget(gl, w, h);
      this.fboW = w;
      this.fboH = h;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboTarget.fbo);
    gl.viewport(0, 0, w, h);
    this._applyUniforms(time, w, h);
    const posLoc = gl.getAttribLocation(this.program, "a_position");
    drawQuad(gl, this.quad, posLoc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return this.fboTarget.tex;
  }

  /** Activate the program and upload all uniforms (built-ins + patch-defined). */
  private _applyUniforms(time: number, width: number, height: number): void {
    const gl = this.gl;
    gl.useProgram(this.program);

    const resLoc = gl.getUniformLocation(this.program, "u_resolution");
    const timeLoc = gl.getUniformLocation(this.program, "u_time");
    if (resLoc !== null) gl.uniform2f(resLoc, width, height);
    if (timeLoc !== null) gl.uniform1f(timeLoc, time);

    for (const [name, uniform] of Object.entries(this.uniforms)) {
      const loc = gl.getUniformLocation(this.program, name);
      if (loc === null) continue;
      switch (uniform.type) {
        case "float":
          gl.uniform1f(loc, uniform.value);
          break;
        case "vec2":
          gl.uniform2fv(loc, uniform.value);
          break;
        case "vec3":
          gl.uniform3fv(loc, uniform.value);
          break;
        case "vec4":
          gl.uniform4fv(loc, uniform.value);
          break;
      }
    }
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.quad);
    gl.deleteProgram(this.program);
    if (this.fboTarget) {
      destroyFBOTarget(gl, this.fboTarget);
      this.fboTarget = null;
    }
  }
}
