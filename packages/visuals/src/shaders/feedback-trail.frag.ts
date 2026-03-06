/**
 * Feedback trail — colour source shader.
 *
 * Generates a moving colour blob.  Feedback accumulation (decay, scroll, warp)
 * is handled by the `FeedbackDevice` node that follows this shader in the
 * pipeline — no `u_prev_frame` needed here.
 *
 * The blob area is painted with full alpha (1.0) so the FeedbackDevice knows
 * where to inject new content.  Background pixels are transparent (alpha 0)
 * so the FeedbackDevice shows only the accumulated history there.
 *
 * Uniforms:
 *   u_speed         float  Movement speed of the colour blob.
 *   u_inject_size   float  Radius of the blob (0.0–0.5 in UV space).
 *   u_inject_bright float  Brightness multiplier for the blob colour (0–2).
 */
export const FEEDBACK_TRAIL_FRAG = /* glsl */ `
precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_inject_size;
uniform float u_inject_bright;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t  = u_time * u_speed;

  // Moving blob position.
  float cx = sin(t * 0.31) * 0.32 + 0.5;
  float cy = cos(t * 0.23) * 0.32 + 0.5;
  float d  = length(uv - vec2(cx, cy));

  // Alpha = 1 inside the blob, 0 outside. The FeedbackDevice uses this mask.
  float alpha = smoothstep(u_inject_size, 0.0, d);

  // Hue-cycling colour.
  vec3 color = vec3(
    sin(uv.x * 8.0 + t)                * 0.5 + 0.5,
    sin(uv.y * 6.0 + t * 1.3)          * 0.5 + 0.5,
    sin((uv.x + uv.y) * 5.0 + t * 0.7) * 0.5 + 0.5
  ) * u_inject_bright;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
}
`;
