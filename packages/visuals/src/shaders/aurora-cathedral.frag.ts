/**
 * Aurora Cathedral — highly artistic modular source shader.
 *
 * A domain-warped field of radial arches and stained-glass veins.
 * Designed to feed modular post-processing nodes (transform/feedback/colorize)
 * with rich colour and a meaningful alpha injection mask.
 *
 * Uniforms:
 *   u_speed        float  overall animation tempo (default 0.42)
 *   u_arch_density float  number of radial arch bands (default 5.0)
 *   u_warp_amount  float  organic flow deformation amount (default 0.28)
 *   u_bloom        float  brightness lift for highlights (default 1.0)
 */
export const AURORA_CATHEDRAL_FRAG = /* glsl */ `
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_arch_density;
uniform float u_warp_amount;
uniform float u_bloom;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 hash2(vec2 p) {
  return vec2(hash(p), hash(p + 19.37));
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 palette(float t) {
  vec3 a = vec3(0.52, 0.44, 0.55);
  vec3 b = vec3(0.45, 0.35, 0.40);
  vec3 c = vec3(1.00, 1.00, 1.00);
  vec3 d = vec3(0.00, 0.18, 0.33);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time * u_speed;

  // Slow camera drift for stage depth.
  uv += vec2(0.04 * sin(t * 0.17), 0.03 * cos(t * 0.11));

  // Domain warp = organic motion.
  float w1 = fbm(uv * 2.2 + vec2(0.0, t * 0.35));
  float w2 = fbm(uv * 2.0 + vec2(3.7, t * 0.27));
  vec2 wuv = uv + (vec2(w1, w2) - 0.5) * u_warp_amount;

  float r = length(wuv);
  float a = atan(wuv.y, wuv.x);

  // Cathedral arches (radial bands).
  float arches = 0.0;
  float density = max(1.0, u_arch_density);
  for (int i = 1; i <= 6; i++) {
    float fi = float(i);
    float ring = fi / density + 0.06 * sin(t * 0.7 + fi * 1.8);
    float d = abs(r - ring);
    arches += smoothstep(0.06, 0.0, d);
  }

  // Stained-glass vein network.
  vec2 cell = floor(wuv * 8.5);
  vec2 rnd = hash2(cell);
  vec2 g = fract(wuv * 8.5) - 0.5;
  g += (rnd - 0.5) * 0.22;
  float vein = 1.0 - smoothstep(0.0, 0.05, min(abs(g.x), abs(g.y)));

  // Aurora curtains.
  float curtains = sin((wuv.x * 3.2 + fbm(wuv * 1.8 + t * 0.15) * 2.0) - t * 0.9);
  curtains = curtains * 0.5 + 0.5;
  curtains *= smoothstep(1.2, 0.1, r);

  // Angular prismatic variation.
  float prism = sin(a * 8.0 + t * 0.4 + fbm(wuv * 3.0) * 2.5) * 0.5 + 0.5;

  float shape = clamp(arches * 0.9 + vein * 0.7 + curtains * 0.8, 0.0, 1.0);
  float hue = fract(prism * 0.6 + curtains * 0.25 + t * 0.03 + r * 0.15);

  vec3 colA = palette(hue);
  vec3 colB = palette(fract(hue + 0.23));
  vec3 color = mix(colA, colB, vein * 0.5 + arches * 0.25);

  // Highlight bloom + deep base tone.
  float glow = pow(shape, 1.8) * u_bloom;
  color = color * (0.35 + 0.9 * shape) + vec3(0.55, 0.72, 1.0) * glow * 0.35;

  // Alpha drives feedback injection; keep low base so memory persists.
  float alpha = clamp(shape * 0.9 + glow * 0.35, 0.0, 1.0);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
}
`;
