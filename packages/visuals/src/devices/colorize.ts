import type { ColorizeDeviceDef } from "../types";
import {
  linkProgram,
  makeQuad,
  makeFBOTarget,
  destroyFBOTarget,
  drawQuad,
  type FBOTarget,
} from "../utils/gl";

const COLORIZE_VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

/**
 * Applies three colour adjustments to u_tex:
 *  1. Hue rotation via the YIQ colour space (cheap, no branching).
 *  2. Saturation scaling (IQ vector magnitude).
 *  3. Contrast stretch around mid-grey 0.5.
 * Output alpha is always 1.
 */
const COLORIZE_FRAG = `
precision mediump float;

uniform sampler2D u_tex;
uniform vec2      u_resolution;
uniform float     u_hue_shift;
uniform float     u_saturation;
uniform float     u_contrast;

void main() {
  vec2 uv  = gl_FragCoord.xy / u_resolution;
  vec3 rgb = texture2D(u_tex, uv).rgb;

  // RGB -> YIQ
  float Y =  0.299  * rgb.r + 0.587  * rgb.g + 0.114  * rgb.b;
  float I =  0.5959 * rgb.r - 0.2746 * rgb.g - 0.3213 * rgb.b;
  float Q =  0.2115 * rgb.r - 0.5227 * rgb.g + 0.3112 * rgb.b;

  // Hue: rotate IQ plane.
  float angle = u_hue_shift * 6.28318;
  float cosA  = cos(angle);
  float sinA  = sin(angle);
  float Ir = cosA * I - sinA * Q;
  float Qr = sinA * I + cosA * Q;

  // Saturation: scale IQ magnitude.
  Ir *= u_saturation;
  Qr *= u_saturation;

  // YIQ -> RGB
  rgb.r = Y + 0.9563 * Ir + 0.6210 * Qr;
  rgb.g = Y - 0.2721 * Ir - 0.6474 * Qr;
  rgb.b = Y - 1.1070 * Ir + 1.7046 * Qr;

  // Contrast around mid-grey.
  rgb = (rgb - 0.5) * u_contrast + 0.5;

  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;

/**
 * Stateless texture-in / texture-out device that applies hue rotation,
 * saturation, and contrast adjustments to the incoming texture.
 */
export class ColorizeDevice {
  readonly id: string;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private quad: WebGLBuffer;
  private fbo: FBOTarget | null = null;
  private fboW = 0;
  private fboH = 0;
  private hueShift: number;
  private saturation: number;
  private contrast: number;

  constructor(gl: WebGLRenderingContext, def: ColorizeDeviceDef) {
    this.id = def.id;
    this.gl = gl;
    this.program = linkProgram(gl, COLORIZE_VERT, COLORIZE_FRAG);
    this.quad = makeQuad(gl);
    const p = def.params ?? {};
    this.hueShift = p.hue_shift ?? 0.0;
    this.saturation = p.saturation ?? 1.0;
    this.contrast = p.contrast ?? 1.0;
  }

  process(
    inputTex: WebGLTexture,
    _time: number,
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
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_hue_shift"),
      this.hueShift,
    );
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_saturation"),
      this.saturation,
    );
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_contrast"),
      this.contrast,
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
