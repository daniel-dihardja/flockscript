import type { VisualPatch } from "@workspace/visuals";
import plasmaPatch from "./plasma.json";
import noisePatch from "./noise.json";
import pixelNoiseWallPatch from "./pixel-noise-wall.json";
import feedbackTrailPatch from "./feedback-trail.json";

export interface PatchExample {
  label: string;
  patch: VisualPatch;
}

export const EXAMPLES: PatchExample[] = [
  { label: "Plasma", patch: plasmaPatch as VisualPatch },
  { label: "Noise — fBm", patch: noisePatch as VisualPatch },
  { label: "Pixel Noise Wall", patch: pixelNoiseWallPatch as VisualPatch },
  { label: "Feedback Trail", patch: feedbackTrailPatch as VisualPatch },
];
