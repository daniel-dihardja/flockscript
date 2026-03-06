import { DEFAULT_VERT } from "./default.vert";
import { PLASMA_FRAG } from "./plasma.frag";
import { NOISE_FRAG } from "./noise.frag";
import { PIXEL_NOISE_WALL_FRAG } from "./pixel-noise-wall.frag";
import { FEEDBACK_TRAIL_FRAG } from "./feedback-trail.frag";
import { MYCELIUM_FRAG } from "./mycelium.frag";
import { PRISMA_FRAG } from "./prisma.frag";
import { AURORA_CATHEDRAL_FRAG } from "./aurora-cathedral.frag";

/** Named vertex shader programs. */
export const VERT_REGISTRY: Record<string, string> = {
  default: DEFAULT_VERT,
};

/** Named fragment shader programs. */
export const FRAG_REGISTRY: Record<string, string> = {
  plasma: PLASMA_FRAG,
  noise: NOISE_FRAG,
  pixelNoiseWall: PIXEL_NOISE_WALL_FRAG,
  feedbackTrail: FEEDBACK_TRAIL_FRAG,
  mycelium: MYCELIUM_FRAG,
  prisma: PRISMA_FRAG,
  auroraCathedral: AURORA_CATHEDRAL_FRAG,
};
