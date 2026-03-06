/**
 * Multi-mode noise shader.
 *
 * Built-in uniforms (injected by VisualEngine every frame):
 *   u_resolution  vec2   canvas size in physical pixels
 *   u_time        float  seconds elapsed
 *
 * User uniforms (configurable via patch JSON):
 *   u_mode      float  0 = white noise, 1 = value noise, 2 = gradient noise, 3 = fBm
 *   u_scale     float  zoom / frequency scale
 *   u_speed     float  animation speed multiplier
 *   u_contrast  float  output contrast (1.0 = neutral)
 */
export const NOISE_FRAG = /* glsl */ `
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

uniform float u_mode;
uniform float u_scale;
uniform float u_speed;
uniform float u_contrast;

// ─── Utilities ───────────────────────────────────────────────────────────────

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

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

// ─── White noise ─────────────────────────────────────────────────────────────

float whiteNoise(vec2 uv, float t) {
  return hash21(uv * u_resolution + floor(t * 24.0));
}

// ─── Value noise ─────────────────────────────────────────────────────────────

float valueNoise(vec2 uv) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  vec2 u = f * f * (3.0 - 2.0 * f); // smooth-step

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ─── Gradient noise (Perlin-style) ───────────────────────────────────────────

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

// ─── fBm (fractal Brownian motion) ───────────────────────────────────────────

float fbm(vec2 uv) {
  float value = 0.0;
  float amp   = 0.5;
  float freq  = 1.0;
  for (int i = 0; i < 6; i++) {
    value += amp * gradNoise(uv * freq);
    amp  *= 0.5;
    freq *= 2.0;
  }
  return value;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * u_speed;

  // Animate by slowly drifting the UV domain
  vec2 suv = uv * u_scale + vec2(t * 0.1, t * 0.07);

  float n;
  if (u_mode < 0.5) {
    // 0 — white noise
    n = whiteNoise(uv, t);
  } else if (u_mode < 1.5) {
    // 1 — value noise
    n = valueNoise(suv);
  } else if (u_mode < 2.5) {
    // 2 — gradient noise
    n = gradNoise(suv);
  } else {
    // 3 — fBm
    n = fbm(suv);
  }

  // Apply contrast around midpoint
  n = clamp((n - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  gl_FragColor = vec4(vec3(n), 1.0);
}
`;
