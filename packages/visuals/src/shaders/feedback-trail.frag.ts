/**
 * Feedback trail shader.
 *
 * Requires the connected screen device to have `feedback: true`.
 * The previous frame is available as `uniform sampler2D u_prev_frame`.
 *
 * Uniforms:
 *   u_decay         float  Retention of the previous frame (0.0–1.0).
 *                          1.0 = 100 % feedback, nothing ever clears.
 *   u_speed         float  Movement speed of the colour blob(s).
 *   u_inject_size   float  Radius of the moving colour blob (0.0–0.5).
 *   u_inject_bright float  Brightness multiplier for the injected colour (0.0–2.0).
 *   u_warp          float  Max UV displacement applied to the previous frame sample.
 *   u_warp_speed    float  How fast the warp noise pattern evolves.
 *   u_blur          float  Softness of the previous-frame sample (0.0 = sharp).
 *   u_scroll_x      float  Horizontal UV offset applied to the prev frame each frame.
 *                          Positive = content drifts right, negative = left.
 *                          Typical range: -0.01 … 0.01.
 *   u_scroll_y      float  Vertical UV offset applied to the prev frame each frame.
 *                          Positive = content drifts up (WebGL UV origin is bottom-left).
 */
export const FEEDBACK_TRAIL_FRAG = /* glsl */ `
precision mediump float;

uniform sampler2D u_prev_frame;
uniform vec2      u_resolution;
uniform float     u_time;
uniform float     u_decay;
uniform float     u_speed;
uniform float     u_inject_size;
uniform float     u_inject_bright;
uniform float     u_warp;
uniform float     u_warp_speed;
uniform float     u_blur;
uniform float     u_scroll_x;
uniform float     u_scroll_y;

// ---- helpers ----------------------------------------------------------------

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Soft sample: averages 5 taps (centre + 4 cardinal neighbours) weighted by
// u_blur, giving a gentle blur on the feedback trail without extra passes.
vec4 samplePrev(vec2 uv) {
  vec2 px = u_blur / u_resolution;
  vec4 c  = texture2D(u_prev_frame, uv);
  c += texture2D(u_prev_frame, uv + vec2( px.x,  0.0));
  c += texture2D(u_prev_frame, uv + vec2(-px.x,  0.0));
  c += texture2D(u_prev_frame, uv + vec2( 0.0,  px.y));
  c += texture2D(u_prev_frame, uv + vec2( 0.0, -px.y));
  return c * 0.2; // average of 5 taps
}

// ---- main -------------------------------------------------------------------

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // UV warp on the previous frame (noise-driven directional drift).
  float warpAngle = hash(uv + u_time * u_warp_speed * 0.01) * 6.28318;
  vec2  warpOffset = vec2(cos(warpAngle), sin(warpAngle)) * u_warp;

  // Directional scroll: shifts the UV lookup so the accumulated image drifts
  // steadily each frame. u_scroll_x > 0 drifts right, u_scroll_y > 0 drifts up.
  vec2 scrollOffset = vec2(u_scroll_x, u_scroll_y);

  vec4  prev = samplePrev(uv + scrollOffset + warpOffset) * u_decay;

  // Moving colour blob.
  float t  = u_time * u_speed;
  float cx = sin(t * 0.31) * 0.32 + 0.5;
  float cy = cos(t * 0.23) * 0.32 + 0.5;
  float d  = length(uv - vec2(cx, cy));
  float inject = smoothstep(u_inject_size, 0.0, d);

  // Hue-cycling colour for the blob.
  vec3 newColor = vec3(
    sin(uv.x * 8.0 + t)               * 0.5 + 0.5,
    sin(uv.y * 6.0 + t * 1.3)         * 0.5 + 0.5,
    sin((uv.x + uv.y) * 5.0 + t * 0.7) * 0.5 + 0.5
  ) * u_inject_bright;

  // mix() = lerp: inject area transitions from prev to newColor without additive
  // blowout. At u_inject = 0 the pixel is purely prev; at 1 it is purely
  // newColor. This means u_decay = 1.0 gives true 100 % retention everywhere
  // the blob is not currently touching.
  gl_FragColor = mix(prev, vec4(clamp(newColor, 0.0, 1.0), 1.0), inject);
}
`;
