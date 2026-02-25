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

  const statements: Array<{ tokens: string[]; startLine: number }> = [];
  let buffer: string[] = [];
  let bufferStart = 0;

  const flushBuffer = () => {
    if (!buffer.length) {
      return;
    }
    statements.push({ tokens: [...buffer], startLine: bufferStart });
    buffer = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("---")) {
      flushBuffer();
      return;
    }
    if (!buffer.length) {
      bufferStart = index;
    }
    buffer.push(...line.split(/\s+/).filter(Boolean));
  });
  flushBuffer();

  const mainKeywords = new Set(["osc", "silence"]);
  const normalize = (token: string) =>
    KEYWORD_ALIASES[token.toLowerCase()] ?? token.toLowerCase();
  const isMainKeyword = (token: string) => mainKeywords.has(normalize(token));

  statements.forEach(({ tokens, startLine }) => {
    let cursor = 0;
    while (cursor < tokens.length) {
      const headToken = tokens[cursor];
      if (!headToken) {
        cursor += 1;
        continue;
      }
      const normalizedHead = normalize(headToken);

      if (normalizedHead === "osc") {
        let nextCursor = cursor + 1;
        while (nextCursor < tokens.length && !isMainKeyword(tokens[nextCursor])) {
          nextCursor += 1;
        }
        const slice = tokens.slice(cursor, nextCursor);
        const oscillator = parseOscStatement(slice, {
          diagnostics,
          generateAutoOscId,
          lineIndex: startLine,
          sourceLines: lines,
        });
        if (oscillator) {
          oscillators.push(oscillator);
        }
        cursor = nextCursor;
        continue;
      }

      if (normalizedHead === "silence") {
        cursor += 1;
        continue;
      }

      diagnostics.push(
        diagnosticForLine(lines, startLine, `Unknown statement: ${headToken}`),
      );
      cursor += 1;
    }
  });

  if (diagnostics.some((diag) => diag.severity === "error")) {
    return { ok: false, diagnostics };
  }

  const patch: CompilePatch = { oscillators };
  return { ok: true, patch, diagnostics };
}
