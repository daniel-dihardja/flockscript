import { diagnosticForLine, getOffsetForLine } from "./diagnostics.ts";
import {
  CompileDiagnostic,
  CompilePatch,
  CompileResult,
  DeviceDefinition,
  DeviceCompileContext,
  RouteDefinition,
} from "./types.ts";
import { getDeviceCompiler } from "./devices/index.ts";
import { compileRoutes } from "./devices/route.ts";
import { resetAutoOscCount } from "./devices/osc.ts";

function extractAudioBlock(
  source: string,
  lines: string[],
  diagnostics: CompileDiagnostic[],
): { body: string; bodyStartLineIndex: number } | null {
  let startLineIndex = 0;
  while (startLineIndex < lines.length && lines[startLineIndex]!.trim() === "") {
    startLineIndex += 1;
  }
  if (startLineIndex >= lines.length) {
    diagnostics.push(
      diagnosticForLine(lines, 0, "Expected 'audio { ... }' block"),
    );
    return null;
  }

  const firstTrimmed = lines[startLineIndex]!.trim();
  if (!/^audio\s*\{/.test(firstTrimmed)) {
    diagnostics.push(
      diagnosticForLine(lines, startLineIndex, "Expected 'audio { ... }' block"),
    );
    return null;
  }

  const offsetToFirstLine = getOffsetForLine(lines, startLineIndex, 0);
  const openBracePos = source.indexOf("{", offsetToFirstLine);
  if (openBracePos === -1) {
    diagnostics.push(
      diagnosticForLine(lines, startLineIndex, "Expected 'audio { ... }' block"),
    );
    return null;
  }

  let depth = 1;
  let closeBracePos = -1;
  for (let i = openBracePos + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        closeBracePos = i;
        break;
      }
    }
  }

  if (closeBracePos === -1) {
    const openBraceLine = (source.slice(0, openBracePos + 1).match(/\n/g) ?? []).length;
    diagnostics.push(
      diagnosticForLine(lines, openBraceLine, "Missing closing '}'"),
    );
    return null;
  }

  const body = source.slice(openBracePos + 1, closeBracePos);
  const bodyStartLineIndex = (source.slice(0, openBracePos + 1).match(/\n/g) ?? []).length;
  return { body, bodyStartLineIndex };
}

export function compile(source: string): CompileResult {
  resetAutoOscCount();

  const lines = source.split("\n");
  const diagnostics: CompileDiagnostic[] = [];
  const devices: DeviceDefinition[] = [];
  const routes: RouteDefinition[] = [];

  const extracted = extractAudioBlock(source, lines, diagnostics);
  if (extracted === null) {
    return {
      ok: false,
      diagnostics,
    };
  }

  const { body, bodyStartLineIndex } = extracted;
  const bodyLines = body.split("\n");

  bodyLines.forEach((rawLine, lineIndex) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("---")) return;

    const context: DeviceCompileContext = {
      lines,
      lineIndex: lineIndex + bodyStartLineIndex,
      diagnostics,
    };

    if (trimmed.startsWith("[")) {
      compileRoutes(trimmed, context, routes);
      return;
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (!tokens.length) return;

    const head = (tokens[0] ?? "").toLowerCase();

    if (head === "silence" || head === "sil") {
      devices.length = 0;
      routes.length = 0;
      return;
    }

    const deviceCompiler = getDeviceCompiler(head);
    if (deviceCompiler) {
      deviceCompiler(tokens, context, devices, routes);
      return;
    }

    diagnostics.push(
      diagnosticForLine(
        lines,
        lineIndex + bodyStartLineIndex,
        `Unknown statement: ${tokens[0] ?? ""}`,
      ),
    );
  });

  const hasError = diagnostics.some((d) => d.severity === "error");
  const patch: CompilePatch = { devices, routes };
  return {
    ok: !hasError,
    diagnostics,
    patch: hasError ? undefined : patch,
  };
}

export type { CompileResult, CompilePatch, DeviceDefinition, RouteDefinition, OscillatorParams } from "./types.ts";
