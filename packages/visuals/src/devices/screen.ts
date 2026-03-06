import type { ScreenDeviceDef } from "../types";
import type { ShaderDevice } from "./shader";

/**
 * Owns the WebGL canvas context and the fullscreen-quad VBO.
 * Acts as the final visual sink: receives a ShaderDevice and draws one frame.
 */
export class ScreenDevice {
  readonly id: string;
  private gl: WebGLRenderingContext;
  private quad: WebGLBuffer;

  constructor(gl: WebGLRenderingContext, def: ScreenDeviceDef) {
    this.id = def.id;
    this.gl = gl;

    // Two triangles covering the full clip-space quad.
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.quad = buf;
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
      gl.viewport(0, 0, w, h);
    }

    shader.applyUniforms(time, canvas.width, canvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const posLoc = gl.getAttribLocation(shader.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    this.gl.deleteBuffer(this.quad);
  }
}
