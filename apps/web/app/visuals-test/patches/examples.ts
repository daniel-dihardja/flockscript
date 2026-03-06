import type { VisualPatch } from "@workspace/visuals";
import plasmaPatch from "./plasma.json";
import noisePatch from "./noise.json";
import pixelNoiseWallPatch from "./pixel-noise-wall.json";

export interface PatchExample {
  label: string;
  patch: VisualPatch;
}

export const EXAMPLES: PatchExample[] = [
  { label: "Plasma", patch: plasmaPatch as VisualPatch },
  { label: "Noise — fBm", patch: noisePatch as VisualPatch },
  { label: "Pixel Noise Wall", patch: pixelNoiseWallPatch as VisualPatch },
];
