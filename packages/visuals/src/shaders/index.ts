import { DEFAULT_VERT } from "./default.vert";
import { PLASMA_FRAG } from "./plasma.frag";
import { NOISE_FRAG } from "./noise.frag";

/** Named vertex shader programs. */
export const VERT_REGISTRY: Record<string, string> = {
  default: DEFAULT_VERT,
};

/** Named fragment shader programs. */
export const FRAG_REGISTRY: Record<string, string> = {
  plasma: PLASMA_FRAG,
  noise: NOISE_FRAG,
};
