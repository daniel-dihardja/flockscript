import type { ScreenDeviceDef } from "../types";
import { linkProgram, makeQuad, drawQuad } from "../utils/gl";

// ─── Passthrough blit program ────────────────────────────────────────────────

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

// ─── ScreenDevice ────────────────────────────────────────────────────────────

/**
 * The final visual sink in the pipeline.
 *
 * Receives a `WebGLTexture` from the preceding node (a `ShaderDevice` or a
 * `FeedbackDevice`) and blits it to the canvas default framebuffer using a
 * minimal passthrough program.
 *
 * All FBO / feedback logic lives in `FeedbackDevice`; this class is purely
 * responsible for presenting the result on-screen.
 */
export class ScreenDevice {
  readonly id: string;
  private gl: WebGLRenderingContext;
  private quad: WebGLBuffer;
  private blitProgram: WebGLProgram;

  constructor(gl: WebGLRenderingContext, def: ScreenDeviceDef) {
    this.id = def.id;
    this.gl = gl;
    this.quad = makeQuad(gl);
    this.blitProgram = linkProgram(gl, BLIT_VERT, BLIT_FRAG);
  }

  /**
   * Blit `tex` to the canvas default framebuffer at the given pixel dimensions.
   * The VisualEngine resizes the canvas and provides consistent `w`/`h` before
   * this is called.
   */
  drawTexture(tex: WebGLTexture, w: number, h: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.blitProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const texLoc = gl.getUniformLocation(this.blitProgram, "u_tex");
    if (texLoc !== null) gl.uniform1i(texLoc, 0);
    const resLoc = gl.getUniformLocation(this.blitProgram, "u_resolution");
    if (resLoc !== null) gl.uniform2f(resLoc, w, h);

    const posLoc = gl.getAttribLocation(this.blitProgram, "a_position");
    drawQuad(gl, this.quad, posLoc);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.quad);
    gl.deleteProgram(this.blitProgram);
  }
}
