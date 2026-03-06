/**
 * Mycelium cascade — organic colour network shader.
 *
 * Generates a domain-warped voronoi cell structure with per-cell hue cycling.
 * Cell edges are painted at full alpha so the FeedbackDevice injects vivid
 * colour there; interiors carry lower alpha so history accumulates inside cells,
 * creating a layered depth effect.
 *
 * The domain warp has a strong downward bias — combined with the FeedbackDevice
 * scroll_y, the whole network cascades vertically from top to bottom.
 *
 * Uniforms:
 *   u_speed       float  Overall animation speed (default 0.4)
 *   u_scale       float  Cell density — higher = finer network (default 4.5)
 *   u_complexity  float  Domain warp amplitude (default 0.35)
 *   u_hue_shift   float  Global hue rotation offset 0–1 (default 0.0)
 */
export const MYCELIUM_FRAG = /* glsl */ `
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_scale;
uniform float u_complexity;
uniform float u_hue_shift;

// ─── Colour ──────────────────────────────────────────────────────────────────

vec3 hsl2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}

// ─── Hash / noise ────────────────────────────────────────────────────────────

float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i),           f),           dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
    mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * gnoise(p);
    p  = p * 2.1 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// ─── Voronoi ─────────────────────────────────────────────────────────────────
// Returns vec2(min-dist, cell-id).

vec2 voronoi(vec2 p) {
  vec2 ij = floor(p), fj = fract(p);
  float minD = 8.0, cellId = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2  n      = vec2(float(x), float(y));
      vec2  jitter = 0.5 + 0.49 * sin(6.2831 * hash2(ij + n) + u_time * u_speed * 0.3);
      float d      = length(n + jitter - fj);
      if (d < minD) { minD = d; cellId = hash1(ij + n); }
    }
  }
  return vec2(minD, cellId);
}

// ─── Main ────────────────────────────────────────────────────────────────────

void main() {
  vec2  uv = gl_FragCoord.xy / u_resolution;
  float t  = u_time * u_speed;

  // Two-pass domain warp with strong downward component.
  float w1    = fbm(uv * 2.5 + vec2(0.0, t * 0.5));
  float w2    = fbm(uv * 2.5 + vec2(w1 * 0.9, w1 * 0.9 + t * 0.25));
  vec2 warped = uv + vec2(w2, w1 - t * 0.08) * u_complexity;

  // Voronoi on warped UV.
  vec2  voro   = voronoi(warped * u_scale);
  float cellD  = voro.x;
  float cellId = voro.y;

  // Edge bands.
  float edge = 1.0 - smoothstep(0.02, 0.12, cellD);
  float glow = 1.0 - smoothstep(0.0,  0.45, cellD);

  // Interior fill noise adds micro-texture.
  float fill = fbm(warped * 7.0 + t * 0.12) * 0.5 + 0.5;

  // Hue assignment: each cell its own slowly-drifting hue.
  float cellHue = fract(cellId * 3.77 + u_hue_shift + t * 0.06 * (cellId - 0.5));
  float edgeHue = fract(cellHue + 0.28 + t * 0.02);
  float fillHue = fract(cellHue + fill * 0.18);

  // Colour layers.
  vec3 edgeCol = hsl2rgb(vec3(edgeHue, 1.0,  0.62 + edge * 0.28));
  vec3 fillCol = hsl2rgb(vec3(fillHue, 0.75, 0.28 + fill * 0.32));
  vec3 glowCol = hsl2rgb(vec3(fract(cellHue + 0.5), 0.95, 0.5));

  vec3 color = mix(fillCol, edgeCol, edge) + glowCol * glow * 0.35;
  color = clamp(color, 0.0, 1.0);

  // Alpha: full on edges/glow, low in dark cell interiors.
  // FeedbackDevice uses this as the injection mask.
  float alpha = smoothstep(0.05, 0.6, edge + glow * 0.45 + fill * 0.15);

  gl_FragColor = vec4(color, alpha);
}
`;
