import type { VisualPatch } from "@workspace/visuals";
import plasmaPatch from "./plasma.json";
import noisePatch from "./noise.json";

export interface PatchExample {
  label: string;
  patch: VisualPatch;
}

export const EXAMPLES: PatchExample[] = [
  { label: "Plasma", patch: plasmaPatch as VisualPatch },
  { label: "Noise — fBm", patch: noisePatch as VisualPatch },
];
