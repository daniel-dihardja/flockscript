/**
 * Prisma - kaleidoscopic SDF shader for electronic music.
 *
 * Kaleidoscope fold + 3 SDF layers: concentric rings, radial spokes,
 * fractal grid. Neon cosine palette. Alpha injection mask on shape edges
 * so FeedbackDevice accumulates vivid smears in the darkness.
 *
 * Uniforms:
 *   u_speed      float  Animation speed (default 0.5)
 *   u_symmetry   float  Fold count 2-8 (default 6)
 *   u_pulse      float  Beat-sync breath depth 0-1 (default 0.5)
 *   u_hue_offset float  Global palette rotation 0-1 (default 0.0)
 */
export const PRISMA_FRAG = /* glsl */ `
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_symmetry;
uniform float u_pulse;
uniform float u_hue_offset;

vec3 neon(float h) {
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.0, 0.9, 0.8);
  vec3 d = vec3(0.0, 0.33, 0.67);
  return a + b * cos(6.28318 * (c * h + d));
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i),              f),              dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
    mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * gnoise(p);
    p  = p * 2.1 + vec2(5.2, 1.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t  = u_time * u_speed;

  float pulse = 1.0 + sin(t * 6.28318 * 1.5) * 0.035 * u_pulse;
  uv *= pulse;

  float wx = fbm(uv * 2.3 + vec2(0.0,  t * 0.28));
  float wy = fbm(uv * 2.3 + vec2(5.2,  t * 0.25));
  vec2 warped = uv + vec2(wx, wy) * 0.13;

  float r   = length(warped);
  float phi = atan(warped.y, warped.x);

  float sym    = max(2.0, u_symmetry);
  float sector = 3.14159265 / sym;
  phi = mod(phi + t * 0.04, 2.0 * sector) - sector;
  phi = abs(phi);
  vec2 kp = vec2(cos(phi), sin(phi)) * r;

  float rings = 0.0;
  for (int i = 1; i <= 5; i++) {
    float fi  = float(i);
    float rad = fi * 0.17 + sin(t * 0.8 + fi * 1.4) * 0.035;
    float d   = abs(length(kp) - rad) - 0.006;
    rings += clamp(1.0 - d / 0.018, 0.0, 1.0);
  }

  float spokes     = 0.0;
  float spokeCount = sym * 2.0;
  for (int i = 0; i < 8; i++) {
    float angle   = (float(i) / spokeCount) * 3.14159265 + t * 0.015;
    vec2  dir     = vec2(cos(angle), sin(angle));
    float d       = abs(dot(kp, vec2(-dir.y, dir.x)));
    float radMask = smoothstep(0.0, 0.45, r) * smoothstep(1.4, 0.6, r);
    spokes += clamp(1.0 - d / 0.010, 0.0, 1.0) * radMask;
  }
  spokes = clamp(spokes, 0.0, 1.0);

  vec2  grid      = fract(warped * 5.0 + t * 0.07) - 0.5;
  float gridLines = 1.0 - smoothstep(0.0, 0.055, min(abs(grid.x), abs(grid.y)));
  float gridMask  = smoothstep(0.35, 0.65, r) * smoothstep(1.6, 0.9, r);
  float gridVal   = gridLines * gridMask;

  float shape = clamp(rings * 1.3 + spokes * 0.9 + gridVal * 0.6, 0.0, 1.0);

  float hueR = fract(u_hue_offset + t * 0.05 + r * 0.35);
  float hueS = fract(hueR + phi / (2.0 * sector) * 0.45);
  float hueG = fract(hueR + 0.55);

  vec3 ringCol  = neon(hueR) * rings;
  vec3 spokeCol = neon(hueS) * spokes;
  vec3 gridCol  = neon(hueG) * gridVal;

  vec3 color = clamp(ringCol + spokeCol * 0.8 + gridCol * 0.55, 0.0, 1.0);
  color = pow(color, vec3(0.72));

  float alpha = smoothstep(0.04, 0.65, shape);

  gl_FragColor = vec4(color, alpha);
}
`;
