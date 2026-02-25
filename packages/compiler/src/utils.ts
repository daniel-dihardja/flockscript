import { OscillatorType } from "./types.ts";

export const WAVE_ALIASES: Record<string, OscillatorType> = {
  sine: "sine",
  sin: "sine",
  square: "square",
  sqr: "square",
  sawtooth: "sawtooth",
  saw: "sawtooth",
  triangle: "triangle",
  tri: "triangle",
};

export const KEYWORD_ALIASES: Record<string, string> = {
  sin: "sine",
  sqr: "square",
  tri: "triangle",
  frq: "freq",
  sil: "silence",
  dtn: "detune",
};

export type OscPropertyKey = "freq" | "gain" | "detune" | "pan";

export const OSC_PROPERTY_ALIASES: Record<string, OscPropertyKey> = {
  freq: "freq",
  frequency: "freq",
  frq: "freq",
  gain: "gain",
  detune: "detune",
  pan: "pan",
};

export const GAIN_TOKEN_REGEX = /^@[+-]?\d+(?:\.\d+)?$/;

export function resolveWave(value: string): OscillatorType | null {
  return WAVE_ALIASES[value.toLowerCase()] ?? null;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function parseNumber(raw: string) {
  const normalized = raw.replace(/c$/, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseGainToken(token: string) {
  if (!token.startsWith("@")) {
    return null;
  }
  return parseNumber(token.slice(1));
}

export function parseOscNumericProperty(
  key: OscPropertyKey,
  raw: string,
) {
  if (key === "gain") {
    const gain = parseGainToken(raw);
    if (gain !== null) {
      return gain;
    }
  }
  return parseNumber(raw);
}

export function findNextPositionalKey(
  params: Partial<Record<OscPropertyKey, number>>,
  order: OscPropertyKey[],
) {
  for (const key of order) {
    if (params[key] == null) {
      return key;
    }
  }
  return null;
}
