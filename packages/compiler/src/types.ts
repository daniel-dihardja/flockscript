export type OscillatorType = "sine" | "square" | "sawtooth" | "triangle";

export type OscillatorEntry = {
  id: string;
  freq: number;
  gain: number;
  type: OscillatorType;
  detune?: number;
  pan?: number;
};

export type CompilePatch = {
  oscillators: OscillatorEntry[];
};

export type CompileDiagnostic = {
  message: string;
  from: number;
  to: number;
  severity: "error" | "warning";
};

export type CompileResult = {
  ok: boolean;
  patch?: CompilePatch;
  diagnostics: CompileDiagnostic[];
};
