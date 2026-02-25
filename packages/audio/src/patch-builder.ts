import Ajv, { ErrorObject } from "ajv";
import audioEngine from "./audio-engine";
import patchSchema from "../../patches/patch-schema.json";

type DeviceType = "osc" | "output";

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

const ajv = new Ajv({ allErrors: true });
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

    const isValid = validatePatch(patchData);
    if (!isValid) {
      throw new Error(`Patch validation failed: ${formatErrors(validatePatch.errors)}`);
    }

    const devices = patchData.devices ?? [];
    const routes = patchData.routes ?? [];

    audioEngine.sendPatch({ devices, routes });
  }
}

export default PatchBuilder;
