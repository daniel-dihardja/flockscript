import { describe, expect, it } from "vitest";
import { compile } from "./index.ts";
import { getDeviceCompiler } from "./devices/index.ts";

describe("osc compiler", () => {
  it("compiles a basic oscillator", () => {
    const result = compile("osc wave=sin frequency=220 @0.25");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]).toMatchObject({
      type: "osc",
      params: { wave: "sine", frequency: 220, gain: 0.25 },
    });
  });

  it("auto-generates an id when omitted", () => {
    const result = compile("osc @0.2");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]?.id).toMatch(/^osc-auto-/);
  });

  it("uses defaults when no params provided", () => {
    const result = compile("osc");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]).toMatchObject({
      type: "osc",
      params: { wave: "sine", frequency: 220, gain: 0.25 },
    });
  });

  it("compiles the Basic Syntax draft block", () => {
    const source = [
      "osc osc1 wave=sine frequency=80 gain=0.7",
      "osc osc2 wave=sine frequency=432 gain=0.03",
      "output out gain=1",
      "",
      "[osc1, osc2] -> out",
    ].join("\n");

    const result = compile(source);
    expect(result.ok).toBe(true);
    expect(result.patch).toBeDefined();
    expect(result.patch?.devices).toHaveLength(3);
    expect(result.patch?.routes).toEqual([
      { from: "osc1.out", to: "out.in", signal: "audio" },
      { from: "osc2.out", to: "out.in", signal: "audio" },
    ]);
  });

  it("reports diagnostics for unsupported statements", () => {
    const result = compile("foo bar");
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.message).toContain("Unknown statement");
  });
});

describe("device registry", () => {
  it("resolves osc and output compilers", () => {
    expect(getDeviceCompiler("osc")).toBeDefined();
    expect(getDeviceCompiler("output")).toBeDefined();
  });

  it("returns undefined for unknown keywords", () => {
    expect(getDeviceCompiler("lfo")).toBeUndefined();
    expect(getDeviceCompiler("unknownDevice")).toBeUndefined();
  });
});

describe("output compiler", () => {
  it("compiles an output device with gain", () => {
    const result = compile("output out gain=0.8");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]).toMatchObject({
      id: "out",
      type: "output",
      params: { gain: 0.8 },
    });
  });

  it("uses default id 'out' when omitted", () => {
    const result = compile("output");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]?.id).toBe("out");
  });
});

describe("route compiler", () => {
  it("compiles a single-source route", () => {
    const source = "osc A\noutput out\n[A] -> out";
    const result = compile(source);
    expect(result.ok).toBe(true);
    expect(result.patch?.routes).toEqual([
      { from: "A.out", to: "out.in", signal: "audio" },
    ]);
  });

  it("compiles a multi-source route", () => {
    const source = "osc A\nosc B\noutput out\n[A, B] -> out";
    const result = compile(source);
    expect(result.ok).toBe(true);
    expect(result.patch?.routes).toHaveLength(2);
  });
});
