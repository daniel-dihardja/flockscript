import { DeviceCompileContext, RouteDefinition } from "../types.ts";
import { diagnosticForLine } from "../diagnostics.ts";

const ROUTE_PATTERN = /^\s*\[([^\]]+)\]\s*->\s*([A-Za-z0-9_-]+)\s*$/;

const pushDiag = (context: DeviceCompileContext, message: string) => {
  context.diagnostics.push(
    diagnosticForLine(context.lines, context.lineIndex, message),
  );
};

const cleanIdentifier = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
};

export function compileRoutes(
  line: string,
  context: DeviceCompileContext,
  routes: RouteDefinition[],
): void {
  const match = line.match(ROUTE_PATTERN);
  if (!match) {
    pushDiag(context, "route syntax is invalid");
    return;
  }

  const sourceList = match[1]!
    .split(",")
    .map((v) => cleanIdentifier(v))
    .filter(Boolean) as string[];

  if (!sourceList.length) {
    pushDiag(context, "route source list is empty");
    return;
  }

  const target = cleanIdentifier(match[2]!);
  if (!target) {
    pushDiag(context, "route target is invalid");
    return;
  }

  for (const source of sourceList) {
    routes.push({ from: `${source}.out`, to: `${target}.in`, signal: "audio" });
  }
}
