import { FRAG_REGISTRY, VERT_REGISTRY } from "../shaders";
import type { ShaderDeviceDef, UniformValue } from "../types";

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile error");
  }
  return shader;
}

/**
 * Compiles a GLSL program from the patch definition.
 * Resolves named keys against the built-in shader registry; falls back to
 * treating the string as raw inline GLSL.
 */
export class ShaderDevice {
  readonly id: string;
  readonly program: WebGLProgram;
  private uniforms: Record<string, UniformValue>;
  private gl: WebGLRenderingContext;

  constructor(gl: WebGLRenderingContext, def: ShaderDeviceDef) {
    this.id = def.id;
    this.gl = gl;
    this.uniforms = def.params.uniforms ?? {};

    const vertSrc = def.params.vert
      ? (VERT_REGISTRY[def.params.vert] ?? def.params.vert)
      : VERT_REGISTRY["default"]!;
    const fragSrc = FRAG_REGISTRY[def.params.frag] ?? def.params.frag;

    const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Program link error");
    }

    // Individual shader objects are no longer needed after linking.
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    this.program = program;
  }

  /**
   * Activates the program and uploads all uniforms.
   * Built-ins (u_resolution, u_time) are always written first; user-defined
   * uniforms from the patch follow.
   *
   * @param prevFrameTex - When the connected screen device has `feedback: true`,
   *   this is the texture of the previous rendered frame. It is bound to texture
   *   unit 0 and exposed as `uniform sampler2D u_prev_frame` in the shader.
   *   Pass `null` for non-feedback renders.
   */
  applyUniforms(
    time: number,
    width: number,
    height: number,
    prevFrameTex: WebGLTexture | null,
  ): void {
    const gl = this.gl;
    gl.useProgram(this.program);

    const resLoc = gl.getUniformLocation(this.program, "u_resolution");
    const timeLoc = gl.getUniformLocation(this.program, "u_time");
    if (resLoc !== null) gl.uniform2f(resLoc, width, height);
    if (timeLoc !== null) gl.uniform1f(timeLoc, time);

    // Bind previous-frame texture when provided.
    if (prevFrameTex !== null) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, prevFrameTex);
      const prevLoc = gl.getUniformLocation(this.program, "u_prev_frame");
      if (prevLoc !== null) gl.uniform1i(prevLoc, 0);
    }

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
    this.gl.deleteProgram(this.program);
  }
}
