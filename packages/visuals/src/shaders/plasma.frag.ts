/**
 * Plasma shader.
 *
 * Built-in uniforms (injected by VisualEngine every frame):
 *   u_resolution  vec2   canvas size in physical pixels
 *   u_time        float  seconds elapsed since engine start
 *
 * User uniforms (configurable via patch JSON):
 *   u_speed        float  time multiplier for the overall animation speed
 *   u_freq_x       float  horizontal sine frequency
 *   u_freq_y       float  vertical sine frequency
 *   u_freq_diag    float  diagonal sine frequency
 *   u_pulse_scale  float  radial ring density
 *   u_pulse_speed  float  radial ring animation speed
 */
export const PLASMA_FRAG = /* glsl */ `
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

uniform float u_speed;
uniform float u_freq_x;
uniform float u_freq_y;
uniform float u_freq_diag;
uniform float u_pulse_scale;
uniform float u_pulse_speed;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * u_speed;

  float r = 0.5 + 0.5 * sin(uv.x * u_freq_x + t);
  float g = 0.5 + 0.5 * sin(uv.y * u_freq_y + t * 1.3);
  float b = 0.5 + 0.5 * sin((uv.x + uv.y) * u_freq_diag - t * 0.7);

  vec2  centered = uv - 0.5;
  float dist  = length(centered);
  float pulse = 0.5 + 0.5 * sin(dist * u_pulse_scale - u_time * u_pulse_speed);

  gl_FragColor = vec4(r * pulse, g * pulse, b, 1.0);
}
`;
