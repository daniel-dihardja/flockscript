import { describe, expect, it } from "vitest";
import { compile } from "./index.ts";

describe("osc compiler", () => {
  it("compiles a basic oscillator", () => {
    const result = compile("osc #lead sin 220 @0.25");
    expect(result.ok).toBe(true);
    expect(result.patch?.oscillators[0]).toMatchObject({
      id: "lead",
      type: "sine",
      freq: 220,
      gain: 0.25,
    });
  });

  it("auto-generates an id when omitted", () => {
    const result = compile("osc sin 330 @0.2");
    expect(result.ok).toBe(true);
    expect(result.patch?.oscillators[0]?.id).toMatch(/^osc-auto-/);
  });

  it("reports diagnostics for unsupported statements", () => {
    const result = compile("foo bar");
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.message).toContain("Unknown statement");
  });
});
