import { clamp, parseNumber, resolveWave } from "../utils.ts";
import {
  DeviceCompileContext,
  DeviceDefinition,
  OscillatorParams,
  RouteDefinition,
} from "../types.ts";
import { diagnosticForLine } from "../diagnostics.ts";

const DEFAULT_FREQUENCY = 220;
const DEFAULT_GAIN = 0.25;
const DEFAULT_WAVE = "sine";

const PARAM_ALIASES = new Map([
  ["wave", "wave"],
  ["frequency", "frequency"],
  ["freq", "frequency"],
  ["frq", "frequency"],
  ["gain", "gain"],
  ["detune", "detune"],
  ["dtn", "detune"],
  ["pan", "pan"],
]);

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

const parseOscParams = (
  tokens: string[],
  context: DeviceCompileContext,
): Partial<OscillatorParams> | null => {
  const params: Partial<OscillatorParams> = {};

  for (const token of tokens) {
    if (!token) continue;

    if (token.startsWith("@")) {
      const parsed = parseNumber(token.slice(1));
      if (parsed === null) {
        pushDiag(context, "osc gain is invalid");
        return null;
      }
      params.gain = parsed;
      continue;
    }

    const assignment = parseAssignment(token);
    if (!assignment) {
      pushDiag(context, `unknown osc option: ${token}`);
      return null;
    }

    const key = PARAM_ALIASES.get(assignment.key);
    if (!key) {
      pushDiag(context, `unknown osc option: ${token}`);
      return null;
    }

    switch (key) {
      case "wave": {
        const wave = resolveWave(assignment.value);
        if (!wave) {
          pushDiag(context, `unsupported osc wave: ${assignment.value}`);
          return null;
        }
        params.wave = wave;
        break;
      }
      case "frequency": {
        const val = parseNumber(assignment.value);
        if (val === null) {
          pushDiag(context, "osc frequency is invalid");
          return null;
        }
        params.frequency = val;
        break;
      }
      case "gain": {
        const val = parseNumber(assignment.value);
        if (val === null) {
          pushDiag(context, "osc gain is invalid");
          return null;
        }
        params.gain = val;
        break;
      }
      case "detune": {
        const val = parseNumber(assignment.value);
        if (val === null) {
          pushDiag(context, "osc detune value is invalid");
          return null;
        }
        params.detune = val;
        break;
      }
      case "pan": {
        const val = parseNumber(assignment.value);
        if (val === null) {
          pushDiag(context, "osc pan value is invalid");
          return null;
        }
        params.pan = val;
        break;
      }
    }
  }

  return params;
};

let autoOscCount = 0;

export function resetAutoOscCount() {
  autoOscCount = 0;
}

export function compileOsc(
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

  const parsedParams = parseOscParams(tokens.slice(cursor), context);
  if (!parsedParams) return;

  const frequency = clamp(parsedParams.frequency ?? DEFAULT_FREQUENCY, 20, 20000);
  const gain = clamp(parsedParams.gain ?? DEFAULT_GAIN, 0, 1);
  const detune =
    parsedParams.detune != null ? clamp(parsedParams.detune, -1200, 1200) : undefined;
  const pan =
    parsedParams.pan != null ? clamp(parsedParams.pan, -1, 1) : undefined;
  const wave = parsedParams.wave ?? DEFAULT_WAVE;

  devices.push({
    id: identifier ?? `osc-auto-${++autoOscCount}`,
    type: "osc",
    params: { wave, frequency, gain, detune, pan },
  });
}
