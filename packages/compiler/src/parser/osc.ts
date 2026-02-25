import {
  GAIN_TOKEN_REGEX,
  clamp,
  parseGainToken,
  parseOscNumericProperty,
  resolveWave,
  OscPropertyKey,
} from "../utils.ts";
import { OscillatorEntry } from "../types.ts";
import { diagnosticForLine } from "../diagnostics.ts";
import { ParserContext } from "./context.ts";

type TokenStream = {
  peek(offset?: number): string | undefined;
  next(): string | undefined;
  hasMore(): boolean;
};

type ParamDescriptor = {
  key: OscPropertyKey;
  aliases: string[];
  positional?: boolean;
  required?: boolean;
  parse: (value: string) => number | null;
};

const PARAM_DESCRIPTORS: ParamDescriptor[] = [
  {
    key: "freq",
    aliases: ["freq", "frequency", "frq"],
    positional: true,
    required: true,
    parse: (value) => parseOscNumericProperty("freq", value),
  },
  {
    key: "gain",
    aliases: ["gain"],
    positional: true,
    required: true,
    parse: (value) => parseOscNumericProperty("gain", value),
  },
  {
    key: "detune",
    aliases: ["detune", "dtn"],
    parse: (value) => parseOscNumericProperty("detune", value),
  },
  {
    key: "pan",
    aliases: ["pan"],
    parse: (value) => parseOscNumericProperty("pan", value),
  },
];

const PARAM_DESCRIPTOR_BY_ALIAS = new Map<string, ParamDescriptor>();
PARAM_DESCRIPTORS.forEach((descriptor) => {
  descriptor.aliases.forEach((alias) =>
    PARAM_DESCRIPTOR_BY_ALIAS.set(alias, descriptor)
  );
});

const POSITIONAL_DESCRIPTORS = PARAM_DESCRIPTORS.filter(
  (descriptor) => descriptor.positional,
);

const positionalInvalidMessage = (key: OscPropertyKey) =>
  key === "freq" || key === "gain"
    ? "osc frequency or gain is invalid"
    : `${key} value is invalid`;

const requiredStatement =
  "osc requires: osc <id?> <wave> <freq> @<gain> [detune <cents>] [pan <value>]";
const DEFAULT_WAVE = "sine";
const DEFAULT_FREQ = 220;
const DEFAULT_GAIN = 0.25;

function createTokenStream(tokens: string[], startIndex = 1): TokenStream {
  let index = startIndex;
  return {
    peek(offset = 0) {
      return tokens[index + offset];
    },
    next() {
      return tokens[index++];
    },
    hasMore() {
      return index < tokens.length;
    },
  };
}

function collectAngleIdentifier(
  initial: string,
  stream: TokenStream,
  pushDiag: (message: string) => void,
): string | undefined {
  if (initial.length === 0) {
    pushDiag("osc identifier cannot be empty");
    return undefined;
  }

  const closingIndex = initial.indexOf(">");
  if (closingIndex !== -1) {
    if (closingIndex !== initial.length - 1) {
      pushDiag("osc identifier must not include extra characters after '>'");
      return undefined;
    }
    return initial.slice(0, closingIndex).trim();
  }

  let value = initial;
  while (stream.hasMore()) {
    const segment = stream.next();
    if (!segment) {
      break;
    }
    const closing = segment.indexOf(">");
    if (closing !== -1) {
      if (closing !== segment.length - 1) {
        pushDiag("osc identifier must not include extra characters after '>'");
        return undefined;
      }
      value += " " + segment.slice(0, closing);
      return value.trim();
    }
    value += " " + segment;
  }

  pushDiag("osc name is not closed with '>'");
  return undefined;
}

function consumeIdentifier(
  stream: TokenStream,
  pushDiag: (message: string) => void,
): string | undefined {
  const candidate = stream.peek();
  if (!candidate) {
    return undefined;
  }
  if (!candidate.startsWith("#") && !candidate.startsWith("<")) {
    return undefined;
  }

  stream.next();
  const trimmed = candidate.startsWith("#")
    ? candidate.slice(1)
    : candidate;
  if (!trimmed.length) {
    pushDiag("osc identifier cannot be empty");
    return undefined;
  }

  if (trimmed.startsWith("<")) {
    return collectAngleIdentifier(
      trimmed.slice(1),
      stream,
      pushDiag,
    );
  }

  return trimmed.trim();
}

function consumeWave(
  stream: TokenStream,
  pushDiag: (message: string) => void,
): string {
  const candidate = stream.peek();
  if (!candidate) {
    return DEFAULT_WAVE;
  }

  const lowerCandidate = candidate.toLowerCase();
  if (lowerCandidate === "wave") {
    stream.next();
    const next = stream.peek();
    if (!next) {
      pushDiag("osc requires a wave type after 'wave'");
      return null;
    }
    stream.next();
    return next;
  }

  stream.next();
  return candidate;
}

function parseParameters(
  stream: TokenStream,
  pushDiag: (message: string) => void,
) {
  const params: Partial<Record<OscPropertyKey, number>> = {};

  while (stream.hasMore()) {
    const token = stream.peek();
    if (!token) {
      break;
    }

    if (GAIN_TOKEN_REGEX.test(token)) {
      const gainValue = parseGainToken(token);
      if (gainValue === null) {
        pushDiag("osc frequency or gain is invalid");
        return null;
      }
      params.gain = gainValue;
      stream.next();
      continue;
    }

    const normalized = token.toLowerCase();
    const descriptor = PARAM_DESCRIPTOR_BY_ALIAS.get(normalized);
    if (descriptor) {
      stream.next();
      const valueToken = stream.next();
      if (!valueToken) {
        pushDiag(`missing value for ${token}`);
        return null;
      }
      const parsedValue = descriptor.parse(valueToken);
      if (parsedValue === null) {
        pushDiag(positionalInvalidMessage(descriptor.key));
        return null;
      }
      params[descriptor.key] = parsedValue;
      continue;
    }

    const positional = POSITIONAL_DESCRIPTORS.find(
      (desc) => params[desc.key] == null,
    );
    if (!positional) {
      pushDiag(`unknown osc option: ${token}`);
      return null;
    }

    const positionalValue = positional.parse(token);
    if (positionalValue === null) {
      pushDiag(positionalInvalidMessage(positional.key));
      return null;
    }
    params[positional.key] = positionalValue;
    stream.next();
  }

  return params;
}

export function parseOscStatement(
  tokens: string[],
  context: ParserContext & { generateAutoOscId: () => string },
): OscillatorEntry | null {
  const { diagnostics, sourceLines, lineIndex, generateAutoOscId } = context;
  const pushDiag = (message: string) =>
    diagnostics.push(diagnosticForLine(sourceLines, lineIndex, message));

  const stream = createTokenStream(tokens);
  const identifier = consumeIdentifier(stream, pushDiag);
  const waveToken = consumeWave(stream, pushDiag);

  const params = parseParameters(stream, pushDiag);
  if (!params) {
    return null;
  }

  const freqToken = params.freq ?? DEFAULT_FREQ;
  const gainToken = params.gain ?? DEFAULT_GAIN;

  const wave = resolveWave(waveToken ?? DEFAULT_WAVE);
  if (!wave) {
    pushDiag(`unsupported osc wave: ${waveToken}`);
    return null;
  }

  const freqValue = clamp(freqToken, 20, 20000);
  const gainValue = clamp(gainToken, 0, 1);
  const detuneValue =
    params.detune != null ? clamp(params.detune, -1200, 1200) : undefined;
  const panValue = params.pan != null ? clamp(params.pan, -1, 1) : 0;

  return {
    id: identifier ?? generateAutoOscId(),
    type: wave,
    freq: freqValue,
    gain: gainValue,
    detune: detuneValue,
    pan: panValue,
  };
}
