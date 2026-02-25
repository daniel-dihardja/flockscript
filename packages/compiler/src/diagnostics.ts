import { CompileDiagnostic } from "./types.ts";

export function getOffsetForLine(
  lines: string[],
  lineIndex: number,
  column: number,
) {
  let offset = 0;
  for (let i = 0; i < lineIndex; i += 1) {
    const line = lines[i] ?? "";
    offset += line.length + 1;
  }
  return offset + column;
}

export function diagnosticForLine(
  lines: string[],
  lineIndex: number,
  message: string,
  severity: "error" | "warning" = "error",
): CompileDiagnostic {
  const line = lines[lineIndex] ?? "";
  const from = getOffsetForLine(lines, lineIndex, 0);
  const to = getOffsetForLine(lines, lineIndex, line.length);
  return { message, from, to, severity };
}
