import type { VisualPatch } from "@workspace/visuals";
import plasmaPatch from "./plasma.json";
import noisePatch from "./noise.json";
import pixelNoiseWallPatch from "./pixel-noise-wall.json";
import feedbackTrailPatch from "./feedback-trail.json";
import myceliumPatch from "./mycelium.json";
import prismaPatch from "./prisma.json";
import modularPrismaPatch from "./modular-prisma.json";
import modularMyceliumPatch from "./modular-mycelium.json";
import modularAuroraCathedralPatch from "./modular-aurora-cathedral.json";

export interface PatchExample {
  label: string;
  patch: VisualPatch;
}

export const EXAMPLES: PatchExample[] = [
  { label: "Plasma", patch: plasmaPatch as VisualPatch },
  { label: "Noise — fBm", patch: noisePatch as VisualPatch },
  { label: "Pixel Noise Wall", patch: pixelNoiseWallPatch as VisualPatch },
  { label: "Feedback Trail", patch: feedbackTrailPatch as VisualPatch },
  { label: "Mycelium Cascade", patch: myceliumPatch as VisualPatch },
  { label: "Prisma", patch: prismaPatch as VisualPatch },
  { label: "Modular — Prisma", patch: modularPrismaPatch as VisualPatch },
  { label: "Modular — Mycelium", patch: modularMyceliumPatch as VisualPatch },
  {
    label: "Modular — Aurora Cathedral",
    patch: modularAuroraCathedralPatch as VisualPatch,
  },
];
