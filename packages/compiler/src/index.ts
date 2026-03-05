import { diagnosticForLine } from "./diagnostics.ts";
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

export function compile(source: string): CompileResult {
  resetAutoOscCount();

  const lines = source.split("\n");
  const diagnostics: CompileDiagnostic[] = [];
  const devices: DeviceDefinition[] = [];
  const routes: RouteDefinition[] = [];

  lines.forEach((rawLine, lineIndex) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("---")) return;

    const context: DeviceCompileContext = { lines, lineIndex, diagnostics };

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
      diagnosticForLine(lines, lineIndex, `Unknown statement: ${tokens[0] ?? ""}`),
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
