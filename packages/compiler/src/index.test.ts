import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { compile, type CompilePatch } from "./index";

const patchesDir = join(__dirname, "..", "..", "patches");

const loadPatch = (filename: string) =>
  JSON.parse(readFileSync(join(patchesDir, filename), "utf-8")) as CompilePatch;

const sineTonePatch = loadPatch("qa-02-sine-tone.json");
const panLfoPatch = loadPatch("qa-05-pan-lfo.json");

describe("dsl compiler", () => {
  it("compiles a basic oscillator patch", () => {
    const result = compile("osc sine sin 440 @0.2 pan 0");
    expect(result.ok).toBe(true);
    expect(result.patch).toEqual(sineTonePatch);
  });

  it("compiles an oscillator with alias routing", () => {
    const source = [
      "osc panOsc sin 330 @0.18 pan 0",
      "lfo panLfo sin rat 0.25 dep 0.9",
      "rte panLfo -> panOsc pan",
    ].join("\n");
    const result = compile(source);
    expect(result.ok).toBe(true);
    expect(result.patch).toEqual(panLfoPatch);
  });

  it("reports diagnostics for invalid oscillator lines", () => {
    const result = compile("osc bass xyz 440 @0.3 pan 0");
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toMatch(/unsupported osc wave/i);
  });

  it("reports diagnostics for malformed routing", () => {
    const result = compile("route panLfo -> panOsc");
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].message).toMatch(/route requires source, target, and param/i);
  });
});
