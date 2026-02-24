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

type VoiceSource = {
  type: "oscillator";
  wave: OscillatorType | null;
  freq: number;
};

type Envelope = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
};

type Sequence = {
  pattern: number[];
  rate: number;
};

type FilterConfig = {
  type?: string;
  freq?: number;
  q?: number;
};

type VoiceEntry = {
  id: string;
  source: VoiceSource;
  envelope: Envelope;
  sequence?: Sequence;
  gain?: number;
  pan?: number;
  filter?: FilterConfig;
};

type CompilePatch = {
  oscillators: OscillatorEntry[];
  modulators: ModulatorEntry[];
  effects: EffectEntry[];
  routing: RoutingEntry[];
  noise?: NoiseEntry[];
  voices?: VoiceEntry[];
};

type CompileDiagnostic = {
  message: string;
  from: number;
  to: number;
  severity: "error" | "warning";
};

type CompileResult = {
  ok: boolean;
  patch?: CompilePatch;
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

const KEYWORD_ALIASES: Record<string, string> = {
  rte: "route",
  dtn: "detune",
  rat: "rate",
  dep: "depth",
  dpt: "depth",
  off: "offset",
  flt: "filter",
  lwp: "lowpass",
  bnp: "bandpass",
  hgp: "highpass",
  dly: "delay",
  sin: "sine",
  sqr: "square",
  tri: "triangle",
  noi: "noise",
  frq: "freq",
  sph: "samplehold",
  smp: "samplehold",
  cha: "chaos",
  chs: "chaos",
  sil: "silence",
  voi: "voice"
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

function findTokenIndex(tokens: string[], target: string) {
  return tokens.findIndex((token) => {
    if (!token) {
      return false;
    }
    const normalized =
      KEYWORD_ALIASES[token.toLowerCase()] ?? token.toLowerCase();
    return normalized === target;
  });
}

export function compile(source: string): CompileResult {
  const lines = source.split("\n");
  const oscillators: OscillatorEntry[] = [];
  const noise: NoiseEntry[] = [];
  const modulators: ModulatorEntry[] = [];
  const effects: EffectEntry[] = [];
  const routing: RoutingEntry[] = [];
  const voices: VoiceEntry[] = [];
  const diagnostics: CompileDiagnostic[] = [];

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
        const normalizedKey = KEYWORD_ALIASES[key] ?? key;
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

        if (normalizedKey === "detune") {
          detune = clamp(literal, -1200, 1200);
        } else if (normalizedKey === "pan") {
          pan = clamp(literal, -1, 1);
        } else {
          diagnostics.push(
            diagnosticForLine(lines, index, `unknown osc option: ${key}`),
          );
          return;
        }
        cursor += 2;
      }

      oscillator.detune = detune;
      oscillator.pan = pan ?? 0;

      oscillators.push(oscillator);
      return;
    }

    if (normalizedHead === "noise") {
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
        const normalizedKey = KEYWORD_ALIASES[key] ?? key;
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
        if (normalizedKey === "pan") {
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

    if (
      normalizedHead === "lfo" ||
      normalizedHead === "samplehold" ||
      normalizedHead === "chaos"
    ) {
      const modType: ModulatorEntry["type"] =
        normalizedHead === "lfo"
          ? "lfo"
          : normalizedHead === "samplehold"
            ? "sampleHold"
            : "chaos";
      const id = tokens[1]!;
      if (!id) {
        diagnostics.push(
          diagnosticForLine(lines, index, `${head} requires an identifier`),
        );
        return;
      }

      const rateIndex = findTokenIndex(tokens, "rate");
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

      if (modType === "lfo") {
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
        const depthIndex = findTokenIndex(tokens, "depth");
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
        const offsetIndex = findTokenIndex(tokens, "offset");
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
        const minIndex = findTokenIndex(tokens, "min");
        const maxIndex = findTokenIndex(tokens, "max");
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
        const centerIndex = findTokenIndex(tokens, "center");
        const rangeIndex = findTokenIndex(tokens, "range");
        const stepIndex = findTokenIndex(tokens, "step");
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

    if (normalizedHead === "route") {
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

      const normalizedParam =
        KEYWORD_ALIASES[param.toLowerCase()] ?? param.toLowerCase();
      if (!ROUTING_PARAMS.has(normalizedParam)) {
        diagnostics.push(
          diagnosticForLine(lines, index, `unsupported route param: ${param}`),
        );
        return;
      }

      routing.push({
        from: source,
        to: target,
        param: normalizedParam,
      });
      return;
    }

    if (normalizedHead === "fx") {
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
      const id = tokens[1]!;
      const type = tokens[2]!;
      if (!id || !type) {
        diagnostics.push(
          diagnosticForLine(lines, index, "fx requires id and type"),
        );
        return;
      }

      const params: EffectEntry = { id, type };
      for (let cursor = 3; cursor < tokens.length; cursor += 2) {
        const key = tokens[cursor];
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

    if (normalizedHead === "voice") {
      const id = tokens[1]!;
      const sourceTypeToken = tokens[2]!;
      const waveToken = tokens[3]!;
      const freqToken = tokens[4]!;
      const gainToken = tokens[5]!;
      if (
        !id ||
        !sourceTypeToken ||
        !waveToken ||
        !freqToken ||
        !gainToken
      ) {
        diagnostics.push(
          diagnosticForLine(
            lines,
            index,
            "voice requires: voice <id> osc <wave> <freq> @<gain> [options]",
          ),
        );
        return;
      }

      const sourceType = sourceTypeToken.toLowerCase();
      if (sourceType !== "oscillator" && sourceType !== "osc") {
        diagnostics.push(
          diagnosticForLine(lines, index, "voice source must be osc/oscillator"),
        );
        return;
      }

      const wave = resolveWave(waveToken);
      const freq = parseNumber(freqToken);
      const gain = parseGainToken(gainToken);
      if (!wave) {
        diagnostics.push(
          diagnosticForLine(lines, index, `unsupported voice wave: ${waveToken}`),
        );
        return;
      }
      if (freq === null || gain === null) {
        diagnostics.push(
          diagnosticForLine(
            lines,
            index,
            "voice frequency or gain is invalid",
          ),
        );
        return;
      }

      let pan = 0;
      let filter: FilterConfig | undefined;
      const envelope: Envelope = {
        attack: 0.01,
        decay: 0.1,
        sustain: 1,
        release: 0.1,
      };
      let sequence: Sequence | undefined;

      let cursor = 6;
      while (cursor < tokens.length) {
        const keyToken = tokens[cursor]!;
        const key = keyToken.toLowerCase();
        cursor += 1;

        if (key === "pan") {
          const valueToken = tokens[cursor++];
          if (!valueToken) {
            diagnostics.push(
              diagnosticForLine(lines, index, "voice pan requires a value"),
            );
            return;
          }
          const value = parseNumber(valueToken);
          if (value === null) {
            diagnostics.push(
              diagnosticForLine(lines, index, "voice pan value is invalid"),
            );
            return;
          }
          pan = clamp(value, -1, 1);
          continue;
        }

        if (key === "env") {
          const attackToken = tokens[cursor++];
          const decayToken = tokens[cursor++];
          const sustainToken = tokens[cursor++];
          const releaseToken = tokens[cursor++];
          if (!attackToken || !decayToken || !sustainToken || !releaseToken) {
            diagnostics.push(
              diagnosticForLine(lines, index, "voice env requires 4 values"),
            );
            return;
          }
          const attack = parseNumber(attackToken);
          const decay = parseNumber(decayToken);
          const sustain = parseNumber(sustainToken);
          const release = parseNumber(releaseToken);
          if (
            attack === null ||
            decay === null ||
            sustain === null ||
            release === null
          ) {
            diagnostics.push(
              diagnosticForLine(lines, index, "voice env values are invalid"),
            );
            return;
          }
          envelope.attack = Math.max(0.001, attack);
          envelope.decay = Math.max(0.001, decay);
          envelope.sustain = clamp(sustain, 0, 1);
          envelope.release = Math.max(0.001, release);
          continue;
        }

        if (key === "seq") {
          const pattern: number[] = [];
          while (cursor < tokens.length) {
            const token = tokens[cursor]!;
            const lower = token.toLowerCase();
            if (lower === "rate") {
              break;
            }
            if (token !== "0" && token !== "1") {
              diagnostics.push(
                diagnosticForLine(
                  lines,
                  index,
                  "voice seq pattern accepts only 0 or 1 values",
                ),
              );
              return;
            }
            pattern.push(Number(token));
            cursor += 1;
          }
          if (pattern.length === 0) {
            diagnostics.push(
              diagnosticForLine(lines, index, "voice seq requires a pattern"),
            );
            return;
          }
          if (
            cursor >= tokens.length ||
            tokens[cursor]!.toLowerCase() !== "rate"
          ) {
            diagnostics.push(
              diagnosticForLine(
                lines,
                index,
                "voice seq requires rate <value>",
              ),
            );
            return;
          }
          cursor += 1;
          const rateToken = tokens[cursor++];
          if (!rateToken) {
            diagnostics.push(
              diagnosticForLine(lines, index, "voice rate value missing"),
            );
            return;
          }
          const rate = parseNumber(rateToken);
          if (rate === null || rate <= 0) {
            diagnostics.push(
              diagnosticForLine(lines, index, "voice rate value is invalid"),
            );
            return;
          }
          sequence = { pattern, rate };
          continue;
        }

        if (key === "filter") {
          const filterTypeToken = tokens[cursor++] ?? "lowpass";
          if (!filterTypeToken) {
            diagnostics.push(
              diagnosticForLine(lines, index, "voice filter requires a type"),
            );
            return;
          }
          const filterConfig: FilterConfig = { type: filterTypeToken };
          while (cursor < tokens.length) {
            const option = tokens[cursor]!.toLowerCase();
            if (option === "freq") {
              cursor += 1;
              const freqValue = tokens[cursor++];
              if (!freqValue) {
                diagnostics.push(
                  diagnosticForLine(
                    lines,
                    index,
                    "voice filter freq missing",
                  ),
                );
                return;
              }
              const freqNum = parseNumber(freqValue);
              if (freqNum === null) {
                diagnostics.push(
                  diagnosticForLine(
                    lines,
                    index,
                    "voice filter freq is invalid",
                  ),
                );
                return;
              }
              filterConfig.freq = clamp(freqNum, 20, 20000);
              continue;
            }
            if (option === "q") {
              cursor += 1;
              const qValue = tokens[cursor++];
              if (!qValue) {
                diagnostics.push(
                  diagnosticForLine(lines, index, "voice filter q missing"),
                );
                return;
              }
              const qNum = parseNumber(qValue);
              if (qNum === null) {
                diagnostics.push(
                  diagnosticForLine(lines, index, "voice filter q invalid"),
                );
                return;
              }
              filterConfig.q = clamp(qNum, 0.0001, 100);
              continue;
            }
            break;
          }
          filter = filterConfig;
          continue;
        }

        diagnostics.push(
          diagnosticForLine(lines, index, `unknown voice option: ${keyToken}`),
        );
        return;
      }

      voices.push({
        id,
        source: {
          type: "oscillator",
          wave,
          freq,
        },
        envelope,
        sequence,
        gain: clamp(gain, 0, 1),
        pan,
        filter,
      });
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

  const patch: CompilePatch = {
    oscillators,
    modulators,
    effects,
    routing,
  };
  if (noise.length > 0) {
    patch.noise = noise;
  }
  if (voices.length > 0) {
    patch.voices = voices;
  }

  return {
    ok: true,
    patch,
    diagnostics,
  };
}

export type {
  CompilePatch,
  CompileDiagnostic,
  CompileResult,
  OscillatorEntry,
  ModulatorEntry,
};
