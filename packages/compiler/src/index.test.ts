import { describe, expect, it } from "vitest";
import { getOffsetForLine } from "./diagnostics.ts";
import { compile } from "./index.ts";
import { getDeviceCompiler } from "./devices/index.ts";

describe("osc compiler", () => {
  it("compiles a basic oscillator", () => {
    const result = compile("audio {\n  osc wave=sin frequency=220 @0.25\n}");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]).toMatchObject({
      type: "osc",
      params: { wave: "sine", frequency: 220, gain: 0.25 },
    });
  });

  it("auto-generates an id when omitted", () => {
    const result = compile("audio {\n  osc @0.2\n}");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]?.id).toMatch(/^osc-auto-/);
  });

  it("uses defaults when no params provided", () => {
    const result = compile("audio {\n  osc\n}");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]).toMatchObject({
      type: "osc",
      params: { wave: "sine", frequency: 220, gain: 0.25 },
    });
  });

  it("compiles the Basic Syntax draft block", () => {
    const source = [
      "audio {",
      "  osc osc1 wave=sine frequency=80 gain=0.7",
      "  osc osc2 wave=sine frequency=432 gain=0.03",
      "  output out gain=1",
      "  ",
      "  [osc1, osc2] -> out",
      "}",
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
    const result = compile("audio {\n  foo bar\n}");
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
    const result = compile("audio {\n  output out gain=0.8\n}");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]).toMatchObject({
      id: "out",
      type: "output",
      params: { gain: 0.8 },
    });
  });

  it("uses default id 'out' when omitted", () => {
    const result = compile("audio {\n  output\n}");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices[0]?.id).toBe("out");
  });
});

describe("route compiler", () => {
  it("compiles a single-source route", () => {
    const source = "audio {\n  osc A\n  output out\n  [A] -> out\n}";
    const result = compile(source);
    expect(result.ok).toBe(true);
    expect(result.patch?.routes).toEqual([
      { from: "A.out", to: "out.in", signal: "audio" },
    ]);
  });

  it("compiles a multi-source route", () => {
    const source = "audio {\n  osc A\n  osc B\n  output out\n  [A, B] -> out\n}";
    const result = compile(source);
    expect(result.ok).toBe(true);
    expect(result.patch?.routes).toHaveLength(2);
  });
});

describe("audio block grammar", () => {
  it("requires audio { ... } wrapper", () => {
    const result = compile("osc osc1 wave=sine");
    expect(result.ok).toBe(false);
    expect(result.patch).toBeUndefined();
    expect(result.diagnostics[0]?.message).toBe("Expected 'audio { ... }' block");
  });

  it("reports missing closing brace", () => {
    const source = "audio {\n  osc osc1 wave=sine\n";
    const result = compile(source);
    expect(result.ok).toBe(false);
    expect(result.patch).toBeUndefined();
    expect(result.diagnostics[0]?.message).toBe("Missing closing '}'");
  });

  it("compiles empty audio block", () => {
    const result = compile("audio { }");
    expect(result.ok).toBe(true);
    expect(result.patch?.devices).toHaveLength(0);
    expect(result.patch?.routes).toHaveLength(0);
  });

  it("reports diagnostic on correct line inside block", () => {
    const source = [
      "audio {",
      "  osc osc1 wave=sine",
      "  badstmt x y",
      "}",
    ].join("\n");
    const result = compile(source);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.message.includes("Unknown statement"))).toBe(true);
    const diag = result.diagnostics.find((d) => d.message.includes("Unknown statement"));
    expect(diag).toBeDefined();
    const lines = source.split("\n");
    const lineIndex = 2;
    const expectedFrom = getOffsetForLine(lines, lineIndex, 0);
    expect(diag!.from).toBe(expectedFrom);
  });
});
