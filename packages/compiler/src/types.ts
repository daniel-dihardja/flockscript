export type OscillatorType = "sine" | "square" | "sawtooth" | "triangle";

export type DeviceType = "osc" | "output";

export type OscillatorParams = {
  wave?: OscillatorType;
  frequency?: number;
  gain?: number;
  detune?: number;
  pan?: number;
};

export type DeviceDefinition = {
  id: string;
  type: DeviceType;
  params: OscillatorParams;
};

export type RouteDefinition = {
  from: string;
  to: string;
  signal: "audio";
};

export type CompilePatch = {
  devices: DeviceDefinition[];
  routes: RouteDefinition[];
};

export type CompileDiagnostic = {
  message: string;
  from: number;
  to: number;
  severity: "error" | "warning";
};

export type OscillatorEntry = {
  id: string;
  type: OscillatorType;
  freq: number;
  gain: number;
  detune?: number;
  pan?: number;
};

export type CompileResult = {
  ok: boolean;
  patch?: CompilePatch;
  diagnostics: CompileDiagnostic[];
};

/**
 * Context passed to every device compiler.
 * Provides access to the full source lines (for diagnostic offsets)
 * and the mutable diagnostics array to push errors/warnings into.
 */
export type DeviceCompileContext = {
  lines: string[];
  lineIndex: number;
  diagnostics: CompileDiagnostic[];
};

/**
 * A device compiler receives the already-tokenised line, the shared context,
 * and the mutable patch arrays to fill.  Returning nothing is intentional —
 * errors are communicated via `context.diagnostics`.
 */
export type DeviceCompiler = (
  tokens: string[],
  context: DeviceCompileContext,
  devices: DeviceDefinition[],
  routes: RouteDefinition[],
) => void;
