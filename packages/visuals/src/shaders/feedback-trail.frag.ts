/**
 * Feedback trail shader.
 *
 * Requires the connected screen device to have `feedback: true`.
 * The previous frame is available as `uniform sampler2D u_prev_frame`.
 *
 * Uniforms:
 *   u_decay        float  How much of the previous frame to retain (0.0–1.0).
 *                         Values close to 1.0 produce long, slow trails.
 *   u_speed        float  Animation speed of the injected colour signal.
 *   u_inject_size  float  Radius of the moving colour blob (0.0–1.0).
 *   u_warp         float  UV displacement amount applied to the previous frame,
 *                         creating a smear / drift effect.
 */
export const FEEDBACK_TRAIL_FRAG = /* glsl */ `
precision mediump float;

uniform sampler2D u_prev_frame;
uniform vec2      u_resolution;
uniform float     u_time;
uniform float     u_decay;
uniform float     u_speed;
uniform float     u_inject_size;
uniform float     u_warp;

// ---- helpers ----------------------------------------------------------------

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// ---- main -------------------------------------------------------------------

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // Slight UV warp applied to the previous frame creates an organic smear.
  float angle = hash(uv + u_time * 0.01) * 6.28318;
  vec2  warpOffset = vec2(cos(angle), sin(angle)) * u_warp;
  vec4  prev = texture2D(u_prev_frame, uv + warpOffset);

  // A moving colour blob to inject fresh signal each frame.
  float t  = u_time * u_speed;
  float cx = sin(t * 0.31) * 0.32 + 0.5;
  float cy = cos(t * 0.23) * 0.32 + 0.5;
  float d  = length(uv - vec2(cx, cy));
  float inject = smoothstep(u_inject_size, 0.0, d);

  // Colour of the injected blob.
  vec3 newColor = vec3(
    sin(uv.x * 8.0 + t)        * 0.5 + 0.5,
    sin(uv.y * 6.0 + t * 1.3)  * 0.5 + 0.5,
    sin((uv.x + uv.y) * 5.0 + t * 0.7) * 0.5 + 0.5
  );

  // Blend: decay previous frame + inject new colour.
  gl_FragColor = prev * u_decay + vec4(newColor, 1.0) * inject;
}
`;
