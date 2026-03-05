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
