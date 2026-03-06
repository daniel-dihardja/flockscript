"use client";

import * as React from "react";

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_uv;
  varying vec2 v_uv;
  void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  varying vec2 v_uv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    vec2 uv = v_uv - 0.5;
    float dist = length(uv) * 2.0;
    float angle = atan(uv.y, uv.x);
    float angleNorm = (angle / 6.28318530718 + 1.0) * 0.5;
    float numAngles = 120.0;
    float angleBin = floor(angleNorm * numAngles);
    float maxR = 0.95;
    float speed = 0.35;
    float t = mod(u_time, maxR / speed);
    float seed = hash(vec2(angleBin * 0.1, 0.0));
    float phase = seed * 0.3;
    float starR = mod(phase * maxR + speed * t, maxR);
    float d = abs(dist - starR);
    float starSize = 0.012 + 0.008 * hash(vec2(angleBin * 0.1, 1.0));
    float star = exp(-d * d / (starSize * starSize));
    float bright = 0.6 + 0.4 * hash(vec2(angleBin * 0.1, 2.0));
    star *= bright;
    vec3 space = vec3(0.02, 0.02, 0.06);
    vec3 starColor = vec3(0.95, 0.97, 1.0);
    vec3 col = mix(space, starColor, star);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function ShaderViewer() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rafRef = React.useRef<number>(0);
  const startTimeRef = React.useRef<number>(0);

  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl = canvas.getContext("webgl", { alpha: false });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = createProgram(gl, vs, fs);
    if (!program) return;

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    const uvLoc = gl.getAttribLocation(program, "a_uv");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const resolutionLoc = gl.getUniformLocation(program, "u_resolution");

    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const uvs = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1,
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    function setSize() {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    setSize();
    startTimeRef.current = performance.now() / 1000;

    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(container);

    function draw() {
      const now = performance.now() / 1000;
      const time = now - startTimeRef.current;

      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(uvLoc);
      gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(timeLoc, time);
      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      gl.deleteProgram(program);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(uvBuffer);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="img"
      aria-label="Starfield flying through space"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ display: "block" }}
      />
    </div>
  );
}
