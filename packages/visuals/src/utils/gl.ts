/**
 * Shared WebGL helpers used across device implementations.
 * Keeps individual device files free of boilerplate.
 */

// ─── Shader / program compilation ───────────────────────────────────────────

/** Compile a single GLSL shader stage. Throws on compile error. */
export function compileShader(
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

/** Compile vert + frag sources and link them into a WebGLProgram. */
export function linkProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) ?? "Program link error");
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return prog;
}

// ─── Fullscreen quad ─────────────────────────────────────────────────────────

/**
 * Create a static VBO containing the two clip-space triangles that cover the
 * entire screen (6 vertices).
 */
export function makeQuad(gl: WebGLRenderingContext): WebGLBuffer {
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  return buf;
}

/**
 * Bind a quad VBO to `a_position` and issue the draw call.
 * The caller must already have the correct program active.
 */
export function drawQuad(
  gl: WebGLRenderingContext,
  quad: WebGLBuffer,
  posLoc: number,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// ─── Framebuffer / texture targets ──────────────────────────────────────────

export interface FBOTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
}

/**
 * Allocate an RGBA8 off-screen render target at the given pixel dimensions.
 * The texture is LINEAR-filtered and CLAMP_TO_EDGE-wrapped.
 */
export function makeFBOTarget(
  gl: WebGLRenderingContext,
  w: number,
  h: number,
): FBOTarget {
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

/** Delete both the framebuffer and its associated texture. */
export function destroyFBOTarget(
  gl: WebGLRenderingContext,
  t: FBOTarget,
): void {
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}
