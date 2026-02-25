import {
  GAIN_TOKEN_REGEX,
  KEYWORD_ALIASES,
  OSC_PROPERTY_ALIASES,
  clamp,
  findNextPositionalKey,
  parseGainToken,
  parseNumber,
  parseOscNumericProperty,
  resolveWave,
  OscPropertyKey,
} from "../utils.ts";
import { OscillatorEntry } from "../types.ts";
import { diagnosticForLine } from "../diagnostics.ts";
import { ParserContext } from "./context.ts";

export type OscParseContext = ParserContext & {
  generateAutoOscId: () => string;
};

export function parseOscStatement(
  tokens: string[],
  context: OscParseContext,
): OscillatorEntry | null {
  const { diagnostics, sourceLines, lineIndex, generateAutoOscId } = context;
  const pushDiag = (message: string) => {
    diagnostics.push(diagnosticForLine(sourceLines, lineIndex, message));
  };

  let cursor = 1;
  let id: string | undefined;
  let waveRaw: string | null = null;

  const readIdentifier = () => {
    const token = tokens[cursor];
    if (!token) {
      return false;
    }
    if (!token.startsWith("#") && !token.startsWith("<")) {
      return false;
    }
    let candidate = token;
    let hasHash = false;
    if (candidate.startsWith("#")) {
      hasHash = true;
      candidate = candidate.slice(1);
    }
    if (!candidate.startsWith("<")) {
      id = candidate;
      cursor += 1;
      return true;
    }
    const remainder = candidate.slice(1);
    const closingIndex = remainder.indexOf(">");
    if (closingIndex !== -1) {
      if (closingIndex !== remainder.length - 1) {
        pushDiag("osc identifier must not include extra characters after '>'");
        return false;
      }
      id = remainder.slice(0, closingIndex);
      cursor += 1;
      return true;
    }
    cursor += 1;
    let value = remainder;
    while (cursor < tokens.length) {
      const part = tokens[cursor];
      if (!part) {
        break;
      }
      const closing = part.indexOf(">");
      if (closing !== -1) {
        value += " " + part.slice(0, closing);
        id = value;
        cursor += 1;
        return true;
      }
      value += " " + part;
      cursor += 1;
    }
    pushDiag("osc name is not closed with '>'");
    return false;
  };

  if (readIdentifier()) {
    if (cursor >= tokens.length) {
      pushDiag("osc requires a wave type after the identifier");
      return null;
    }
  }

  const firstToken = tokens[cursor];
  if (!firstToken) {
    pushDiag(
      "osc requires: osc <id?> <wave> <freq> @<gain> [detune <cents>] [pan <value>]",
    );
    return null;
  }

  const readWaveToken = (): string | null => {
    const candidate = tokens[cursor];
    if (!candidate) {
      pushDiag("osc requires a wave type");
      return null;
    }
    const lowerCandidate = candidate.toLowerCase();
    if (lowerCandidate === "wave") {
      cursor += 1;
      const next = tokens[cursor];
      if (!next) {
        pushDiag("osc requires a wave type after 'wave'");
        return null;
      }
      cursor += 1;
      return next;
    }
    cursor += 1;
    return candidate;
  };

  const lowerFirst = firstToken.toLowerCase();
  const nextToken = tokens[cursor + 1];
  const nextIsWave =
    typeof nextToken === "string" &&
    (resolveWave(nextToken) !== null || nextToken.toLowerCase() === "wave");
  const firstIsWave = Boolean(resolveWave(firstToken));

  if (lowerFirst === "wave") {
    id = id ?? generateAutoOscId();
    cursor += 1;
    waveRaw = readWaveToken();
  } else if (firstIsWave && !nextIsWave) {
    id ??= generateAutoOscId();
    waveRaw = firstToken;
    cursor += 1;
  } else if (!firstIsWave && nextIsWave) {
    id = firstToken;
    cursor += 1;
    waveRaw = readWaveToken();
  } else if (firstIsWave && nextIsWave) {
    id = firstToken;
    cursor += 1;
    waveRaw = readWaveToken();
  } else {
    id = firstToken;
    cursor += 1;
    waveRaw = readWaveToken();
  }

  if (!waveRaw) {
    return null;
  }

  const params: Partial<Record<OscPropertyKey, number>> = {};
  const positionalOrder: OscPropertyKey[] = ["freq", "gain"];

  while (cursor < tokens.length) {
    const currentToken = tokens[cursor];
    if (!currentToken) {
      break;
    }
    const normalizedToken =
      KEYWORD_ALIASES[currentToken.toLowerCase()] ?? currentToken.toLowerCase();

    const propertyKey = OSC_PROPERTY_ALIASES[normalizedToken];
    if (propertyKey) {
      cursor += 1;
      const valueToken = tokens[cursor];
      if (!valueToken) {
        pushDiag(`missing value for ${normalizedToken}`);
        return null;
      }
      const parsedValue = parseOscNumericProperty(propertyKey, valueToken);
      if (parsedValue === null) {
        const message =
          propertyKey === "freq" || propertyKey === "gain"
            ? "osc frequency or gain is invalid"
            : `${propertyKey} value is invalid`;
        pushDiag(message);
        return null;
      }
      params[propertyKey] = parsedValue;
      cursor += 1;
      continue;
    }

    if (GAIN_TOKEN_REGEX.test(currentToken) && params.gain == null) {
      const gainValue = parseGainToken(currentToken);
      if (gainValue === null) {
        pushDiag("osc frequency or gain is invalid");
        return null;
      }
      params.gain = gainValue;
      cursor += 1;
      continue;
    }

    const positionalKey = findNextPositionalKey(params, positionalOrder);
    if (!positionalKey) {
      pushDiag(`unknown osc option: ${currentToken}`);
      return null;
    }

    const positionalValue = parseOscNumericProperty(
      positionalKey,
      currentToken,
    );
    if (positionalValue === null) {
      const message =
        positionalKey === "freq" || positionalKey === "gain"
          ? "osc frequency or gain is invalid"
          : `${positionalKey} value is invalid`;
      pushDiag(message);
      return null;
    }
    params[positionalKey] = positionalValue;
    cursor += 1;
  }

  if (params.freq == null || params.gain == null) {
    pushDiag(
      "osc requires: osc <id?> <wave> <freq> @<gain> [detune <cents>] [pan <value>]",
    );
    return null;
  }

  const freqValue = clamp(params.freq, 20, 20000);
  const gainValue = clamp(params.gain, 0, 1);
  const detuneValue =
    params.detune != null ? clamp(params.detune, -1200, 1200) : undefined;
  const panValue = params.pan != null ? clamp(params.pan, -1, 1) : 0;

  const wave = resolveWave(waveRaw);
  if (!wave) {
    pushDiag(`unsupported osc wave: ${waveRaw}`);
    return null;
  }

  return {
    id: id ?? generateAutoOscId(),
    type: wave,
    freq: freqValue,
    gain: gainValue,
    detune: detuneValue,
    pan: panValue,
  };
}
