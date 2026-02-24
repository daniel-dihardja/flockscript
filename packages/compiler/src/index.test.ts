import { describe, expect, it } from "vitest";
import { compile, type CompilePatch } from "./index.ts";

const sineTonePatch: CompilePatch = {
  oscillators: [
    {
      id: "sine",
      freq: 440,
      gain: 0.2,
      type: "sine",
      pan: 0,
    },
  ],
  modulators: [],
  effects: [],
  routing: [],
};

const panLfoPatch: CompilePatch = {
  oscillators: [
    {
      id: "panOsc",
      freq: 330,
      gain: 0.18,
      type: "sine",
      pan: 0,
    },
  ],
  modulators: [
    {
      type: "lfo",
      id: "panLfo",
      rate: 0.25,
      depth: 0.9,
      wave: "sine",
    },
  ],
  effects: [],
  routing: [
    {
      from: "panLfo",
      to: "panOsc",
      param: "pan",
    },
  ],
};

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
    expect(result.diagnostics[0]?.message).toMatch(/unsupported osc wave/i);
  });

  it("reports diagnostics for malformed routing", () => {
    const result = compile("route panLfo -> panOsc");
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.message).toMatch(
      /route requires source, target, and param/i,
    );
  });

  it("treats the silence command as a valid no-op", () => {
    const result = compile("sil");
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.patch.oscillators).toHaveLength(0);
    expect(result.patch.effects).toHaveLength(0);
  });

  it("compiles a voice sequence", () => {
    const source = [
      "voi kick osc sin 60 @0.5 pan -0.2 env 0.001 0.02 0.6 0.1",
      "seq 1 0 1 0 rate 4 filter lowpass freq 150 q 2",
    ].join(" ");
    const result = compile(source);
    expect(result.ok).toBe(true);
    expect(result.patch.voices).toHaveLength(1);
    const voice = result.patch.voices![0];
    expect(voice.envelope.attack).toBeCloseTo(0.001);
    expect(voice.sequence).toEqual({ pattern: [1, 0, 1, 0], rate: 4 });
    expect(voice.filter?.type).toBe("lowpass");
    expect(voice.filter?.freq).toBe(150);
    expect(voice.pan).toBeCloseTo(-0.2);
  });

  it("supports pan routing", () => {
    const result = compile("route wobble -> bass pan");
    expect(result.ok).toBe(true);
    expect(result.patch.routing[0]).toEqual({
      from: "wobble",
      to: "bass",
      param: "pan",
    });
  });

  it("parses compressor fx settings", () => {
    const result = compile(
      "fx sidechain compressor threshold -30 ratio 6 attack 0.005 release 0.2 knee 4 makeup 3",
    );
    expect(result.ok).toBe(true);
    expect(result.patch.effects).toHaveLength(1);
    expect(result.patch.effects[0]).toEqual({
      id: "sidechain",
      type: "compressor",
      threshold: -30,
      ratio: 6,
      attack: 0.005,
      release: 0.2,
      knee: 4,
      makeup: 3,
    });
  });

  it("accepts wave keyword + offset on LFO", () => {
    const result = compile(
      "lfo wobble wave square rate 1 depth 120 offset 50",
    );
    expect(result.ok).toBe(true);
    expect(result.patch.modulators).toHaveLength(1);
    const mod = result.patch.modulators[0];
    expect(mod.wave).toBe("square");
    expect(mod.rate).toBe(1);
    expect(mod.depth).toBe(120);
    expect(mod.offset).toBe(50);
  });
});
