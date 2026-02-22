import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { compile, type CompilePatch } from "./dsl-worker";

const patchesDir = join(__dirname, "../../../../..", "packages", "patches");

const loadPatch = (filename: string) =>
  JSON.parse(readFileSync(join(patchesDir, filename), "utf-8")) as CompilePatch;

const sineTonePatch = loadPatch("qa-02-sine-tone.json");
const panLfoPatch = loadPatch("qa-05-pan-lfo.json");

describe("dsl compiler", () => {
  it("compiles a basic oscillator patch", () => {
    const result = compile("osc sine sine 440 @0.2 pan 0");
    expect(result.ok).toBe(true);
    expect(result.patch).toEqual(sineTonePatch);
  });

  it("compiles an oscillator with pan macro routing", () => {
    const source = [
      "osc panOsc sine 330 @0.18 pan 0",
      "lfo panLfo sine rate 0.25 depth 0.9",
      "route panLfo -> panOsc pan",
    ].join("\n");
    const result = compile(source);
    expect(result.ok).toBe(true);
    expect(result.patch).toEqual(panLfoPatch);
  });
});
