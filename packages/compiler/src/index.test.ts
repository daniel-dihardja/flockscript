import { describe, expect, it } from "vitest";
import { compile } from "./index.ts";

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

  it("reports diagnostics for unsupported statements", () => {
    const result = compile("foo bar");
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.message).toContain("Unknown statement");
  });
});
