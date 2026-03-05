import { diagnosticForLine } from "./diagnostics.ts";
import {
  CompileDiagnostic,
  CompilePatch,
  CompileResult,
  DeviceDefinition,
  RouteDefinition,
  OscillatorParams,
} from "./types.ts";
import {
  clamp,
  KEYWORD_ALIASES,
  parseNumber,
  resolveWave,
} from "./utils.ts";

const ROUTE_PATTERN = /^\s*\[([^\]]+)\]\s*->\s*([A-Za-z0-9_-]+)\s*$/;
const DEFAULT_OSC_FREQUENCY = 220;
const DEFAULT_OSC_GAIN = 0.25;
const DEFAULT_OSC_WAVE = "sine";

const OSC_PARAM_ALIASES = new Map([
  ["wave", "wave"],
  ["frequency", "frequency"],
  ["freq", "frequency"],
  ["frq", "frequency"],
  ["gain", "gain"],
  ["detune", "detune"],
  ["dtn", "detune"],
  ["pan", "pan"],
]);

type OscParamKey = "wave" | "frequency" | "gain" | "detune" | "pan";

type ParserContext = {
  diagnostics: CompileDiagnostic[];
  lines: string[];
};

const normalizeKeyword = (value: string) =>
  KEYWORD_ALIASES[value.toLowerCase()] ?? value.toLowerCase();

const cleanIdentifier = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("#")) {
    return trimmed.slice(1);
  }
  return trimmed;
};

const parseAssignment = (token: string) => {
  const position = token.indexOf("=");
  if (position === -1) {
    return null;
  }
  const key = token.slice(0, position).trim();
  const value = token.slice(position + 1).trim();
  if (!key || !value) {
    return null;
  }
  return { key: key.toLowerCase(), value };
};

const pushDiagnostic = (
  context: ParserContext,
  lineIndex: number,
  message: string,
  severity: "error" | "warning" = "error",
) => {
  context.diagnostics.push(
    diagnosticForLine(context.lines, lineIndex, message, severity),
  );
};

const parseOscParams = (
  tokens: string[],
  context: ParserContext,
  lineIndex: number,
): Partial<OscillatorParams> | null => {
  const params: Partial<OscillatorParams> = {};

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    if (token.startsWith("@")) {
      const valueToken = token.slice(1);
      const parsedGain = parseNumber(valueToken);
      if (parsedGain === null) {
        pushDiagnostic(context, lineIndex, "osc frequency or gain is invalid");
        return null;
      }
      params.gain = parsedGain;
      continue;
    }

    const assignment = parseAssignment(token);
    if (!assignment) {
      pushDiagnostic(context, lineIndex, `unknown osc option: ${token}`);
      return null;
    }

    const normalizedKey = OSC_PARAM_ALIASES.get(assignment.key);
    if (!normalizedKey) {
      pushDiagnostic(context, lineIndex, `unknown osc option: ${token}`);
      return null;
    }

    switch (normalizedKey) {
      case "wave": {
        const wave = resolveWave(assignment.value);
        if (!wave) {
          pushDiagnostic(context, lineIndex, `unsupported osc wave: ${assignment.value}`);
          return null;
        }
        params.wave = wave;
        break;
      }
      case "frequency": {
        const frequency = parseNumber(assignment.value);
        if (frequency === null) {
          pushDiagnostic(context, lineIndex, "osc frequency or gain is invalid");
          return null;
        }
        params.frequency = frequency;
        break;
      }
      case "gain": {
        const gain = parseNumber(assignment.value);
        if (gain === null) {
          pushDiagnostic(context, lineIndex, "osc frequency or gain is invalid");
          return null;
        }
        params.gain = gain;
        break;
      }
      case "detune": {
        const detune = parseNumber(assignment.value);
        if (detune === null) {
          pushDiagnostic(context, lineIndex, "osc detune value is invalid");
          return null;
        }
        params.detune = detune;
        break;
      }
      case "pan": {
        const pan = parseNumber(assignment.value);
        if (pan === null) {
          pushDiagnostic(context, lineIndex, "osc pan value is invalid");
          return null;
        }
        params.pan = pan;
        break;
      }
    }
  }

  return params;
};

const parseOscillatorLine = (
  tokens: string[],
  context: ParserContext,
  lineIndex: number,
  generateAutoId: () => string,
  devices: DeviceDefinition[],
) => {
  let cursor = 1;
  let identifier: string | undefined;

  const secondOscToken = tokens[1];
  if (secondOscToken !== undefined && !secondOscToken.startsWith("@") && !secondOscToken.includes("=")) {
    const candidate = cleanIdentifier(secondOscToken);
    if (candidate) {
      identifier = candidate;
      cursor = 2;
    }
  }

  const paramsTokens = tokens.slice(cursor);
  const parsedParams = parseOscParams(paramsTokens, context, lineIndex);
  if (!parsedParams) {
    return;
  }

  const frequency = clamp(
    parsedParams.frequency ?? DEFAULT_OSC_FREQUENCY,
    20,
    20000,
  );
  const gain = clamp(parsedParams.gain ?? DEFAULT_OSC_GAIN, 0, 1);
  const detune = parsedParams.detune != null
    ? clamp(parsedParams.detune, -1200, 1200)
    : undefined;
  const pan = parsedParams.pan != null
    ? clamp(parsedParams.pan, -1, 1)
    : undefined;
  const wave = parsedParams.wave ?? DEFAULT_OSC_WAVE;

  devices.push({
    id: identifier ?? generateAutoId(),
    type: "osc",
    params: {
      wave,
      frequency,
      gain,
      detune,
      pan,
    },
  });
};

const parseOutputLine = (
  tokens: string[],
  context: ParserContext,
  lineIndex: number,
  devices: DeviceDefinition[],
) => {
  let cursor = 1;
  let identifier: string | undefined;

  const secondOutToken = tokens[1];
  if (secondOutToken !== undefined && !secondOutToken.startsWith("@") && !secondOutToken.includes("=")) {
    const candidate = cleanIdentifier(secondOutToken);
    if (candidate) {
      identifier = candidate;
      cursor = 2;
    }
  }

  let gain: number | undefined;
  const paramsTokens = tokens.slice(cursor);
  for (const token of paramsTokens) {
    if (!token) continue;
    const assignment = parseAssignment(token);
    if (!assignment) {
      pushDiagnostic(context, lineIndex, `unknown output option: ${token}`);
      return;
    }
    if (assignment.key !== "gain") {
      pushDiagnostic(context, lineIndex, `unknown output option: ${token}`);
      return;
    }
    const parsedGain = parseNumber(assignment.value);
    if (parsedGain === null) {
      pushDiagnostic(context, lineIndex, "output gain is invalid");
      return;
    }
    gain = clamp(parsedGain, 0, 1);
  }

  devices.push({
    id: identifier ?? "out",
    type: "output",
    params: {
      gain,
    },
  });
};

const parseRouteLine = (
  line: string,
  context: ParserContext,
  lineIndex: number,
): RouteDefinition[] | null => {
  const match = line.match(ROUTE_PATTERN);
  if (!match) {
    pushDiagnostic(context, lineIndex, "route syntax is invalid");
    return null;
  }

  const sourceList = match[1]!
    .split(",")
    .map((value) => cleanIdentifier(value))
    .filter((value) => Boolean(value)) as string[];
  if (!sourceList.length) {
    pushDiagnostic(context, lineIndex, "route source list is empty");
    return null;
  }

  const target = cleanIdentifier(match[2]!);
  if (!target) {
    pushDiagnostic(context, lineIndex, "route target is invalid");
    return null;
  }

  return sourceList.map((source) => ({
    from: `${source}.out`,
    to: `${target}.in`,
    signal: "audio",
  }));
};

export function compile(source: string): CompileResult {
  const lines = source.split("\n");
  const diagnostics: CompileDiagnostic[] = [];
  const devices: DeviceDefinition[] = [];
  const routes: RouteDefinition[] = [];
  let unnamedOscCount = 0;
  const generateAutoOscId = () => `osc-auto-${++unnamedOscCount}`;
  const context: ParserContext = { diagnostics, lines };

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("---")) {
      return;
    }
    if (trimmed.startsWith("[")) {
      const parsedRoutes = parseRouteLine(trimmed, context, index);
      if (parsedRoutes) {
        routes.push(...parsedRoutes);
      }
      return;
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      return;
    }

    const normalizedHead = normalizeKeyword(tokens[0] ?? "");

    if (normalizedHead === "silence" || normalizedHead === "sil") {
      devices.length = 0;
      routes.length = 0;
      return;
    }

    if (normalizedHead === "osc") {
      parseOscillatorLine(tokens, context, index, generateAutoOscId, devices);
      return;
    }

    if (normalizedHead === "output") {
      parseOutputLine(tokens, context, index, devices);
      return;
    }

    pushDiagnostic(context, index, `Unknown statement: ${tokens[0] ?? ""}`);
  });

  const hasError = diagnostics.some((diag) => diag.severity === "error");
  const patch: CompilePatch = { devices, routes };
  return {
    ok: !hasError,
    diagnostics,
    patch: hasError ? undefined : patch,
  };
}

export type { CompileResult, CompilePatch, DeviceDefinition, RouteDefinition, OscillatorParams } from "./types.ts";
