/**
 * Stage noise shader.
 *
 * Same uniforms as before:
 *   u_mode      float  0 = storm, 1 = liquid metal, 2 = glitch cells, 3 = void pulse
 *   u_scale     float  zoom / frequency scale
 *   u_speed     float  animation speed multiplier
 *   u_contrast  float  output contrast
 */
export const NOISE_FRAG = /* glsl */ `
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

uniform float u_mode;
uniform float u_scale;
uniform float u_speed;
uniform float u_contrast;

// ─── Hash / noise utils ──────────────────────────────────────────────────────

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float valueNoise(vec2 uv) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float gradNoise(vec2 uv) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = dot(hash22(i)              * 2.0 - 1.0, f);
  float b = dot(hash22(i + vec2(1,0))  * 2.0 - 1.0, f - vec2(1,0));
  float c = dot(hash22(i + vec2(0,1))  * 2.0 - 1.0, f - vec2(0,1));
  float d = dot(hash22(i + vec2(1,1))  * 2.0 - 1.0, f - vec2(1,1));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 0.5 + 0.5;
}

float fbm(vec2 uv) {
  float value = 0.0;
  float amp = 0.5;
  float freq = 1.0;

  for (int i = 0; i < 6; i++) {
    value += amp * gradNoise(uv * freq);
    amp *= 0.5;
    freq *= 2.0;
  }
  return value;
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

// ridge shaping: turns soft noise into sharper structures
float ridge(float n) {
  return 1.0 - abs(n * 2.0 - 1.0);
}

// ─── Main ────────────────────────────────────────────────────────────────────

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv - 0.5;
  p.x *= u_resolution.x / u_resolution.y;

  float t = u_time * u_speed;

  // Base coordinates
  vec2 q = p * u_scale;

  // Domain warp for more alive motion
  vec2 warp;
  warp.x = fbm(q * 0.8 + vec2(0.0, t * 0.25));
  warp.y = fbm(q * 0.8 + vec2(5.2, -t * 0.22));
  q += (warp - 0.5) * 2.0;

  // Secondary rotating layer
  vec2 qr = rot(t * 0.15) * q;

  float n1 = fbm(qr + vec2(t * 0.18, -t * 0.12));
  float n2 = gradNoise(q * 2.2 - vec2(t * 0.30, t * 0.10));
  float n3 = valueNoise(q * 5.0 + vec2(-t * 0.8, t * 0.6));

  float r1 = ridge(n1);
  float r2 = ridge(n2);

  float dist = length(p);
  float radial = 1.0 / (1.0 + dist * 4.5);

  float signal = 0.0;
  vec3 color = vec3(0.0);

  if (u_mode < 0.5) {
    // 0 — STORM: energetic smoky plasma ridges
    signal = r1 * 0.65 + n2 * 0.25 + n3 * 0.10;
    signal += radial * 0.18;
    signal = pow(clamp(signal, 0.0, 1.0), 1.2);

    color = mix(
      vec3(0.02, 0.03, 0.05),
      vec3(0.15, 0.55, 1.0),
      signal
    );
    color += pow(signal, 6.0) * vec3(0.9, 1.0, 1.2);
  } else if (u_mode < 1.5) {
    // 1 — LIQUID METAL: glossy grayscale with highlights
    signal = r1 * 0.5 + r2 * 0.35 + n3 * 0.15;
    signal = smoothstep(0.25, 0.95, signal);

    float shine = pow(max(0.0, r2), 12.0);
    color = mix(vec3(0.02), vec3(0.75), signal);
    color += shine * vec3(1.0);
  } else if (u_mode < 2.5) {
    // 2 — GLITCH CELLS: blocky digital aggression
    vec2 cellUV = floor((uv + (warp - 0.5) * 0.08) * (u_scale * 14.0)) / (u_scale * 14.0);
    float cell = valueNoise(cellUV * 8.0 + floor(t * 3.0));
    float lines = sin((uv.y + cell * 0.1) * 220.0) * 0.5 + 0.5;

    signal = ridge(cell) * 0.7 + lines * 0.3;
    signal = smoothstep(0.35, 0.85, signal);

    color = mix(
      vec3(0.01, 0.01, 0.01),
      vec3(0.95, 0.95, 0.95),
      signal
    );
    color *= 0.75 + 0.25 * step(0.6, lines);
  } else {
    // 3 — VOID PULSE: radial, ritual, drone-friendly
    float angle = atan(p.y, p.x);
    float ring = sin(dist * 18.0 - t * 3.0 + n1 * 4.0);
    float swirl = sin(angle * 6.0 + t * 1.5 + n2 * 5.0);

    signal = 0.45 * r1 + 0.25 * r2 + 0.15 * ring + 0.15 * swirl;
    signal += radial * 0.25;
    signal = smoothstep(0.25, 0.9, signal);

    color = mix(
      vec3(0.0, 0.0, 0.0),
      vec3(0.8, 0.15, 0.1),
      signal
    );
    color += pow(signal, 4.0) * vec3(1.0, 0.6, 0.2);
  }

  // global contrast
  color = clamp((color - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  // subtle vignette for stage focus
  color *= 1.0 - dist * 0.35;

  gl_FragColor = vec4(color, 1.0);
}
`;
