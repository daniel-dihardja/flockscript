import type { TransformDeviceDef } from "../types";
import {
  linkProgram,
  makeQuad,
  makeFBOTarget,
  destroyFBOTarget,
  drawQuad,
  type FBOTarget,
} from "../utils/gl";

const TRANSFORM_VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

/**
 * Samples u_tex at a UV that has been scaled around the center, rotated
 * by (u_rotate * u_time) radians, then offset by (u_offset_x, u_offset_y)
 * accumulated over time.  Output alpha is always 1.
 */
const TRANSFORM_FRAG = `
precision mediump float;

uniform sampler2D u_tex;
uniform vec2      u_resolution;
uniform float     u_time;
uniform float     u_scale;
uniform float     u_rotate;
uniform float     u_offset_x;
uniform float     u_offset_y;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // Scroll offset accumulated over time.
  uv += vec2(u_offset_x, u_offset_y) * u_time;

  // Scale around center.
  uv = (uv - 0.5) / max(u_scale, 0.001) + 0.5;

  // Rotate around center.
  float angle = u_rotate * u_time;
  float c = cos(angle), s = sin(angle);
  uv -= 0.5;
  uv  = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
  uv += 0.5;

  gl_FragColor = vec4(texture2D(u_tex, uv).rgb, 1.0);
}
`;

/**
 * Stateless texture-in / texture-out device that applies UV scale, rotation,
 * and offset to the incoming texture each frame.
 */
export class TransformDevice {
  readonly id: string;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private quad: WebGLBuffer;
  private fbo: FBOTarget | null = null;
  private fboW = 0;
  private fboH = 0;
  private scale: number;
  private rotate: number;
  private offsetX: number;
  private offsetY: number;

  constructor(gl: WebGLRenderingContext, def: TransformDeviceDef) {
    this.id = def.id;
    this.gl = gl;
    this.program = linkProgram(gl, TRANSFORM_VERT, TRANSFORM_FRAG);
    this.quad = makeQuad(gl);
    const p = def.params ?? {};
    this.scale = p.scale ?? 1.0;
    this.rotate = p.rotate ?? 0.0;
    this.offsetX = p.offset_x ?? 0.0;
    this.offsetY = p.offset_y ?? 0.0;
  }

  process(
    inputTex: WebGLTexture,
    time: number,
    w: number,
    h: number,
  ): WebGLTexture {
    const gl = this.gl;

    if (!this.fbo || this.fboW !== w || this.fboH !== h) {
      if (this.fbo) destroyFBOTarget(gl, this.fbo);
      this.fbo = makeFBOTarget(gl, w, h);
      this.fboW = w;
      this.fboH = h;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo.fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_tex"), 0);
    gl.uniform2f(gl.getUniformLocation(this.program, "u_resolution"), w, h);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_time"), time);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_scale"), this.scale);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_rotate"), this.rotate);
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_offset_x"),
      this.offsetX,
    );
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_offset_y"),
      this.offsetY,
    );

    drawQuad(gl, this.quad, gl.getAttribLocation(this.program, "a_position"));

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.fbo.tex;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.quad);
    if (this.fbo) destroyFBOTarget(gl, this.fbo);
    this.fbo = null;
  }
}
