/**
 * Pixel Noise Wall shader.
 *
 * Built-in uniforms:
 *   u_resolution  vec2
 *   u_time        float
 *
 * User uniforms:
 *   u_speed          float  master animation speed
 *   u_pixel_size     float  size of the pixel blocks
 *   u_noise_scale    float  noise spatial scale
 *   u_contrast       float  threshold/contrast strength
 *   u_glitch         float  horizontal glitch intensity
 *   u_scan_strength  float  scanline modulation amount
 *   u_blink_speed    float  global flicker speed
 */
export const PIXEL_NOISE_WALL_FRAG = /* glsl */ `
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

uniform float u_speed;
uniform float u_pixel_size;
uniform float u_noise_scale;
uniform float u_contrast;
uniform float u_glitch;
uniform float u_scan_strength;
uniform float u_blink_speed;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x)
       + (c - a) * u.y * (1.0 - u.x)
       + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * u_speed;

  // Pixelation
  vec2 pixelUV = floor(gl_FragCoord.xy / u_pixel_size) * u_pixel_size;
  vec2 puv = pixelUV / u_resolution.xy;

  // Horizontal glitch bands
  float bandId = floor(puv.y * 40.0 + t * 0.5);
  float bandShift = (hash(vec2(bandId, floor(t * 6.0))) - 0.5) * u_glitch;
  puv.x += bandShift;

  // Base layered noise
  float n1 = noise(puv * u_noise_scale + vec2(t * 0.15, -t * 0.09));
  float n2 = noise(puv * (u_noise_scale * 2.3) + vec2(-t * 0.41, t * 0.27));
  float n3 = noise((puv + vec2(0.13, 0.71)) * (u_noise_scale * 6.0) + t * 0.8);

  float field = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;

  // Radial pressure to make it feel less flat
  vec2 centered = puv - 0.5;
  centered.x *= u_resolution.x / u_resolution.y;
  float dist = length(centered);
  field += 0.18 / (1.0 + dist * 8.0);

  // Global blink / stage strobe feel
  float blink = 0.85 + 0.15 * sin(u_time * u_blink_speed);

  // Scanline modulation
  float scan = sin(gl_FragCoord.y * 0.8 + t * 8.0) * 0.5 + 0.5;
  field *= mix(1.0, scan, u_scan_strength);

  field *= blink;

  // Hard threshold / contrast shaping
  field = smoothstep(0.5 - u_contrast, 0.5 + u_contrast, field);

  // Limited cold industrial palette
  vec3 dark   = vec3(0.02, 0.03, 0.04);
  vec3 mid    = vec3(0.08, 0.25, 0.32);
  vec3 bright = vec3(0.75, 0.95, 1.00);

  vec3 color = mix(dark, mid, field);
  color = mix(color, bright, pow(field, 3.0));

  // Occasional hot pixels
  float cellRand = hash(floor(gl_FragCoord.xy / u_pixel_size) + floor(t * 12.0));
  color += step(0.985, cellRand) * 0.35;

  gl_FragColor = vec4(color, 1.0);
}
`;
