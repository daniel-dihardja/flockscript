type CompileRequest = {
  id: number;
  source: string;
};

type CompileDiagnostic = {
  message: string;
  from: number;
  to: number;
  severity: "error" | "warning";
};

type OscillatorType = "sine" | "square" | "sawtooth" | "triangle";

type OscillatorEntry = {
  id: string;
  freq: number;
  gain: number;
  type: OscillatorType;
  detune?: number;
  pan?: number;
};

type NoiseEntry = {
  id: string;
  gain: number;
  pan?: number;
};

type ModulatorEntry = {
  type: "lfo" | "sampleHold" | "chaos";
  id: string;
  rate: number;
  wave?: OscillatorType;
  depth?: number;
  offset?: number;
  min?: number;
  max?: number;
  center?: number;
  range?: number;
  step?: number;
};

type RoutingEntry = {
  from: string;
  to: string;
  param: string;
};

type EffectEntry = {
  type: string;
  id?: string;
  [key: string]: unknown;
};

type FaustConfig = {
  module: string;
  params?: Record<string, number>;
  bypassEffects?: boolean;
};

export type CompilePatch = {
  oscillators: OscillatorEntry[];
  modulators: ModulatorEntry[];
  effects: EffectEntry[];
  routing: RoutingEntry[];
  noise?: NoiseEntry[];
  faust?: FaustConfig;
};

type CompileResponse =
  | {
      id: number;
      ok: true;
      patch: CompilePatch;
      diagnostics: CompileDiagnostic[];
    }
  | {
      id: number;
      ok: false;
      diagnostics: CompileDiagnostic[];
    };

const WAVE_ALIASES: Record<string, OscillatorType> = {
  sine: "sine",
  sin: "sine",
  square: "square",
  sqr: "square",
  sawtooth: "sawtooth",
  saw: "sawtooth",
  triangle: "triangle",
  tri: "triangle",
};

const ROUTING_PARAMS = new Set([
  "frequency",
  "freq",
  "detune",
  "gain",
  "q",
  "time",
  "feedback",
  "pan",
]);

function resolveWave(value: string): OscillatorType | null {
  return WAVE_ALIASES[value.toLowerCase()] ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(raw: string) {
  const normalized = raw.replace(/c$/, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseGainToken(token: string) {
  if (!token.startsWith("@")) {
    return null;
  }
  return parseNumber(token.slice(1));
}

function parseBooleanToken(token: string) {
  const normalized = token.toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function parseLiteralValue(raw: string) {
  const lowered = raw.toLowerCase();
  if (lowered === "true") {
    return true;
  }
  if (lowered === "false") {
    return false;
  }
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : raw;
}

function getOffsetForLine(lines: string[], lineIndex: number, column: number) {
  let offset = 0;
  for (let i = 0; i < lineIndex; i += 1) {
    const line = lines[i] ?? "";
    offset += line.length + 1;
  }
  return offset + column;
}

function diagnosticForLine(
  lines: string[],
  lineIndex: number,
  message: string,
  severity: "error" | "warning" = "error",
) {
  const line = lines[lineIndex] ?? "";
  const from = getOffsetForLine(lines, lineIndex, 0);
  const to = getOffsetForLine(lines, lineIndex, line.length);
  return { message, from, to, severity } as CompileDiagnostic;
}

export function compile(source: string) {
  const lines = source.split("\n");
  const oscillators: OscillatorEntry[] = [];
  const noise: NoiseEntry[] = [];
  const modulators: ModulatorEntry[] = [];
  const effects: EffectEntry[] = [];
  const routing: RoutingEntry[] = [];
  const diagnostics: CompileDiagnostic[] = [];
  let faust: FaustConfig | undefined;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("---")) {
      return;
    }

    const tokens = line.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      return;
    }

    const headToken = tokens[0];
    if (!headToken) {
      return;
    }
    const head = headToken.toLowerCase();

    if (head === "osc") {
      if (tokens.length < 5) {
        diagnostics.push(
          diagnosticForLine(
            lines,
            index,
            "osc requires: osc <id> <wave> <freq> @<gain> [detune <cents>] [pan <value>]",
          ),
        );
        return;
      }

      const id = tokens[1]!;
      const waveRaw = tokens[2]!;
      const freqToken = tokens[3]!;
      const gainToken = tokens[4]!;

      if (!id || !waveRaw || !freqToken || !gainToken) {
        diagnostics.push(
          diagnosticForLine(
            lines,
            index,
            "osc requires: osc <id> <wave> <freq> @<gain> [detune <cents>] [pan <value>]",
          ),
        );
        return;
      }

      const wave = resolveWave(waveRaw);
      if (!wave) {
        diagnostics.push(
          diagnosticForLine(lines, index, `unsupported osc wave: ${waveRaw}`),
        );
        return;
      }

      const freq = parseNumber(freqToken);
      const gain = parseGainToken(gainToken);
      if (freq === null || gain === null) {
        diagnostics.push(
          diagnosticForLine(lines, index, "osc frequency or gain is invalid"),
        );
        return;
      }

      const oscillator: OscillatorEntry = {
        id,
        type: wave,
        freq: clamp(freq, 20, 20000),
        gain: clamp(gain, 0, 1),
      };

      let detune: number | undefined;
      let pan: number | undefined;
      let cursor = 5;
      while (cursor < tokens.length) {
        const keyToken = tokens[cursor];
        if (!keyToken) {
          diagnostics.push(
            diagnosticForLine(lines, index, "missing option key"),
          );
          return;
        }
        const key = keyToken.toLowerCase();
        const valueToken = tokens[cursor + 1];
        if (!valueToken) {
          diagnostics.push(
            diagnosticForLine(lines, index, `missing value for ${key}`),
          );
          return;
        }
        const literal = parseNumber(valueToken);
        if (literal === null) {
          diagnostics.push(
            diagnosticForLine(lines, index, `${key} value is invalid`),
          );
          return;
        }

        if (key === "detune") {
          detune = clamp(literal, -1200, 1200);
        } else if (key === "pan") {
          pan = clamp(literal, -1, 1);
        } else {
          diagnostics.push(
            diagnosticForLine(lines, index, `unknown osc option: ${key}`),
          );
          return;
        }
        cursor += 2;
      }

      if (typeof detune === "number") {
        oscillator.detune = detune;
      }
      if (typeof pan === "number") {
        oscillator.pan = pan;
      } else {
        oscillator.pan = 0;
      }

      oscillators.push(oscillator);
      return;
    }

    if (head === "noise") {
      if (tokens.length < 3) {
        diagnostics.push(
          diagnosticForLine(
            lines,
            index,
            "noise requires: noise <id> @<gain> [pan <value>]",
          ),
        );
        return;
      }

      const id = tokens[1]!;
      const gainToken = tokens[2]!;
      const gain = parseGainToken(gainToken);
      if (!id || gain === null) {
        diagnostics.push(
          diagnosticForLine(lines, index, "noise requires id and gain"),
        );
        return;
      }

      const entry: NoiseEntry = {
        id,
        gain: clamp(gain, 0, 1),
        pan: 0,
      };

      let cursor = 3;
      while (cursor < tokens.length) {
        const keyToken = tokens[cursor];
        if (!keyToken) {
          diagnostics.push(
            diagnosticForLine(lines, index, "missing noise option key"),
          );
          return;
        }
        const key = keyToken.toLowerCase();
        const valueToken = tokens[cursor + 1];
        if (!valueToken) {
          diagnostics.push(
            diagnosticForLine(lines, index, `missing value for ${key}`),
          );
          return;
        }
        const literal = parseNumber(valueToken);
        if (literal === null) {
          diagnostics.push(
            diagnosticForLine(lines, index, `${key} value is invalid`),
          );
          return;
        }
        if (key === "pan") {
          entry.pan = clamp(literal, -1, 1);
        } else {
          diagnostics.push(
            diagnosticForLine(lines, index, `unknown noise option: ${key}`),
          );
          return;
        }
        cursor += 2;
      }

      noise.push(entry);
      return;
    }

    if (head === "lfo" || head === "samplehold" || head === "chaos") {
      const modType: ModulatorEntry["type"] =
        head === "lfo" ? "lfo" : head === "samplehold" ? "sampleHold" : "chaos";
      const id = tokens[1]!;
      if (!id) {
        diagnostics.push(
          diagnosticForLine(lines, index, `${head} requires an identifier`),
        );
        return;
      }

      const rateIndex = tokens.indexOf("rate");
      if (rateIndex === -1 || !tokens[rateIndex + 1]) {
        diagnostics.push(
          diagnosticForLine(lines, index, `${head} requires rate value`),
        );
        return;
      }
      const rateValue = parseNumber(tokens[rateIndex + 1]!);
      if (rateValue === null) {
        diagnostics.push(
          diagnosticForLine(lines, index, `${head} rate value is invalid`),
        );
        return;
      }

      const entry: ModulatorEntry = {
        type: modType,
        id,
        rate: rateValue,
      };

      if (head === "lfo") {
        const wave = resolveWave(tokens[2]!);
        if (!wave) {
          diagnostics.push(
            diagnosticForLine(
              lines,
              index,
              `unsupported lfo wave: ${tokens[2]}`,
            ),
          );
          return;
        }
        const depthIndex = tokens.indexOf("depth");
        if (depthIndex === -1 || !tokens[depthIndex + 1]) {
          diagnostics.push(
            diagnosticForLine(lines, index, "lfo requires depth value"),
          );
          return;
        }
        const depthValue = parseNumber(tokens[depthIndex + 1]!);
        if (depthValue === null) {
          diagnostics.push(
            diagnosticForLine(lines, index, "lfo depth value is invalid"),
          );
          return;
        }
        entry.wave = wave;
        entry.depth = depthValue;
        const offsetIndex = tokens.indexOf("offset");
        if (offsetIndex !== -1) {
        const offsetToken = tokens[offsetIndex + 1]!;
          if (!offsetToken) {
            diagnostics.push(
              diagnosticForLine(lines, index, "lfo offset is invalid"),
            );
            return;
          }
        const offset = parseNumber(offsetToken);
          if (offset === null) {
            diagnostics.push(
              diagnosticForLine(lines, index, "lfo offset is invalid"),
            );
            return;
          }
          entry.offset = offset;
        }
      }

      if (modType === "sampleHold") {
        const minIndex = tokens.indexOf("min");
        const maxIndex = tokens.indexOf("max");
        if (minIndex === -1 || maxIndex === -1) {
          diagnostics.push(
            diagnosticForLine(lines, index, "samplehold requires min and max"),
          );
          return;
        }
        const minValue = parseNumber(tokens[minIndex + 1]!);
        const maxValue = parseNumber(tokens[maxIndex + 1]!);
        if (minValue === null || maxValue === null) {
          diagnostics.push(
            diagnosticForLine(lines, index, "samplehold bounds are invalid"),
          );
          return;
        }
        entry.min = minValue;
        entry.max = maxValue;
      }

      if (modType === "chaos") {
        const centerIndex = tokens.indexOf("center");
        const rangeIndex = tokens.indexOf("range");
        const stepIndex = tokens.indexOf("step");
        if (centerIndex === -1 || rangeIndex === -1 || stepIndex === -1) {
          diagnostics.push(
            diagnosticForLine(
              lines,
              index,
              "chaos requires center, range, step",
            ),
          );
          return;
        }
        const centerValue = parseNumber(tokens[centerIndex + 1]!);
        const rangeValue = parseNumber(tokens[rangeIndex + 1]!);
        const stepValue = parseNumber(tokens[stepIndex + 1]!);
        if (centerValue === null || rangeValue === null || stepValue === null) {
          diagnostics.push(
            diagnosticForLine(lines, index, "chaos values are invalid"),
          );
          return;
        }
        entry.center = centerValue;
        entry.range = rangeValue;
        entry.step = stepValue;
      }

      modulators.push(entry);
      return;
    }

    if (head === "route") {
      const arrowIndex = tokens.indexOf("->");
      if (
        arrowIndex === -1 ||
        arrowIndex === 1 ||
        arrowIndex === tokens.length - 1
      ) {
        diagnostics.push(
          diagnosticForLine(
            lines,
            index,
            "route requires: route <source> -> <target> <param>",
          ),
        );
        return;
      }

      const source = tokens[1];
      const target = tokens[arrowIndex + 1]!;
      const param = tokens[arrowIndex + 2]!;
      if (!source || !target || !param) {
        diagnostics.push(
          diagnosticForLine(
            lines,
            index,
            "route requires source, target, and param",
          ),
        );
        return;
      }

      if (!ROUTING_PARAMS.has(param)) {
        diagnostics.push(
          diagnosticForLine(lines, index, `unsupported route param: ${param}`),
        );
        return;
      }

      routing.push({ from: source, to: target, param });
      return;
    }

    if (head === "fx") {
      if (tokens.length < 3) {
        diagnostics.push(
          diagnosticForLine(
            lines,
            index,
            "fx requires: fx <id> <type> [key value]...",
          ),
        );
        return;
      }
      const id = tokens[1];
      const type = tokens[2];
      if (!id || !type) {
        diagnostics.push(
          diagnosticForLine(lines, index, "fx requires id and type"),
        );
        return;
      }

      const params: EffectEntry = { id, type };
      for (let cursor = 3; cursor < tokens.length; cursor += 2) {
        const key = tokens[cursor];
        const keyToken = tokens[cursor];
        const valueToken = tokens[cursor + 1];
        if (!key || !valueToken) {
          diagnostics.push(
            diagnosticForLine(lines, index, "fx parameters must be key/value"),
          );
          return;
        }
        params[key] = parseLiteralValue(valueToken);
      }

      effects.push(params);
      return;
    }

    if (head === "faust") {
      const kvPairs = tokens.slice(1);
      const entry: Record<string, string> = {};
      kvPairs.forEach((pair) => {
        const [key, value] = pair.split("=");
        if (key && value) {
          entry[key] = value;
        }
      });

      const moduleName = entry.module;
      if (!moduleName) {
        diagnostics.push(
          diagnosticForLine(lines, index, "faust requires module=<name>"),
        );
        return;
      }

      const faustParams: Record<string, number> = {};
      Object.entries(entry).forEach(([key, value]) => {
        if (key === "module") {
          return;
        }
        if (key === "bypassEffects") {
          return;
        }
        const parsed = parseNumber(value);
        if (parsed === null) {
          diagnostics.push(
            diagnosticForLine(lines, index, `faust param ${key} is invalid`),
          );
          return;
        }
        faustParams[key] = parsed;
      });

      const bypass = entry.bypassEffects
        ? parseBooleanToken(entry.bypassEffects)
        : undefined;

      faust = {
        module: moduleName,
        ...(Object.keys(faustParams).length ? { params: faustParams } : {}),
        ...(typeof bypass === "boolean" ? { bypassEffects: bypass } : {}),
      };
      return;
    }

    diagnostics.push(
      diagnosticForLine(lines, index, `Unknown statement: ${head}`),
    );
  });

  if (diagnostics.some((diag) => diag.severity === "error")) {
    return { ok: false, diagnostics } as const;
  }

  const patch: CompilePatch = {
    oscillators,
    modulators,
    effects,
    routing,
  };
  if (noise.length > 0) {
    patch.noise = noise;
  }
  if (faust) {
    patch.faust = faust;
  }

  return {
    ok: true,
    patch,
    diagnostics,
  } as const;
}

const workerScope =
  typeof self !== "undefined" && "postMessage" in self ? self : undefined;

if (workerScope) {
  workerScope.onmessage = (event: MessageEvent<CompileRequest>) => {
    const { id, source } = event.data;
    const result = compile(source);

    const response: CompileResponse = result.ok
      ? {
          id,
          ok: true,
          patch: result.patch,
          diagnostics: result.diagnostics,
        }
      : {
          id,
          ok: false,
          diagnostics: result.diagnostics,
        };

    workerScope.postMessage(response);
  };
}
