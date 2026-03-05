import { clamp, parseNumber } from "../utils.ts";
import {
  DeviceCompileContext,
  DeviceDefinition,
  RouteDefinition,
} from "../types.ts";
import { diagnosticForLine } from "../diagnostics.ts";

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

const parseAssignment = (token: string) => {
  const pos = token.indexOf("=");
  if (pos === -1) return null;
  const key = token.slice(0, pos).trim();
  const value = token.slice(pos + 1).trim();
  return key && value ? { key: key.toLowerCase(), value } : null;
};

export function compileOutput(
  tokens: string[],
  context: DeviceCompileContext,
  devices: DeviceDefinition[],
  _routes: RouteDefinition[],
): void {
  let cursor = 1;
  let identifier: string | undefined;

  const second = tokens[1];
  if (second !== undefined && !second.startsWith("@") && !second.includes("=")) {
    const candidate = cleanIdentifier(second);
    if (candidate) {
      identifier = candidate;
      cursor = 2;
    }
  }

  let gain: number | undefined;
  for (const token of tokens.slice(cursor)) {
    if (!token) continue;
    const assignment = parseAssignment(token);
    if (!assignment || assignment.key !== "gain") {
      pushDiag(context, `unknown output option: ${token}`);
      return;
    }
    const parsed = parseNumber(assignment.value);
    if (parsed === null) {
      pushDiag(context, "output gain is invalid");
      return;
    }
    gain = clamp(parsed, 0, 1);
  }

  devices.push({
    id: identifier ?? "out",
    type: "output",
    params: { gain },
  });
}
