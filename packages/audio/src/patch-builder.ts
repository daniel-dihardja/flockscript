import Ajv, { ErrorObject } from "ajv";
import audioEngine from "./audio-engine";
import patchSchema from "../../patches/patch-schema.json";

type DeviceType = "osc" | "lfo" | "filter" | "output";

type SyntaxDevice = {
  id?: string;
  type: DeviceType;
  params?: Record<string, unknown>;
};

type SyntaxRoute = {
  from: string;
  to: string;
  signal: string;
};

type SyntaxPatch = {
  devices: SyntaxDevice[];
  routes: SyntaxRoute[];
};

const ajv = new Ajv({ allErrors: true, coerceTypes: true });
const validatePatch = ajv.compile(patchSchema as Record<string, unknown>);

const formatErrors = (errors: ErrorObject[] | null | undefined) =>
  (errors ?? [])
    .map((error) => {
      const path = error.instancePath || error.schemaPath;
      return `${path} ${error.message ?? "validation failed"}`.trim();
    })
    .join("; ");

class PatchBuilder {
  build(patchData: SyntaxPatch) {
    if (!audioEngine || !audioEngine.isRunning || !audioEngine.workletReady) {
      throw new Error("Audio engine is not ready");
    }

    // Normalize LLM output: drop null params so schema validation passes
    const normalized: SyntaxPatch = {
      ...patchData,
      devices: (patchData.devices ?? []).map((d) =>
        d.params == null ? { id: d.id, type: d.type } : d,
      ),
    };

    const isValid = validatePatch(normalized);
    if (!isValid) {
      throw new Error(
        `Patch validation failed: ${formatErrors(validatePatch.errors)}`,
      );
    }

    const devices = normalized.devices ?? [];
    const routes = normalized.routes ?? [];

    audioEngine.sendPatch({ devices, routes });
  }
}

export default PatchBuilder;
