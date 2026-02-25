import { parseOscStatement } from "./parser/osc.ts";
import { diagnosticForLine } from "./diagnostics.ts";
import {
  CompileDiagnostic,
  CompilePatch,
  CompileResult,
  OscillatorEntry,
} from "./types.ts";
import { KEYWORD_ALIASES } from "./utils.ts";

export function compile(source: string): CompileResult {
  const lines = source.split("\n");
  const oscillators: OscillatorEntry[] = [];
  const diagnostics: CompileDiagnostic[] = [];
  let unnamedOscCount = 0;
  const generateAutoOscId = () => `osc-auto-${++unnamedOscCount}`;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("---")) {
      return;
    }

    const tokens = line.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      return;
    }

    const rawHead = tokens[0];
    if (!rawHead) {
      return;
    }
    const head = rawHead.toLowerCase();
    const normalizedHead = KEYWORD_ALIASES[head] ?? head;

    if (normalizedHead === "osc") {
      const oscillator = parseOscStatement(tokens, {
        diagnostics,
        generateAutoOscId,
        lineIndex: index,
        sourceLines: lines,
      });
      if (oscillator) {
        oscillators.push(oscillator);
      }
      return;
    }

    if (normalizedHead === "silence") {
      return;
    }

    diagnostics.push(
      diagnosticForLine(lines, index, `Unknown statement: ${head}`),
    );
  });

  if (diagnostics.some((diag) => diag.severity === "error")) {
    return { ok: false, diagnostics };
  }

  const patch: CompilePatch = { oscillators };
  return { ok: true, patch, diagnostics };
}
