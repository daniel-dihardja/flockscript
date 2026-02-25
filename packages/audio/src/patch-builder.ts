import audioEngine from "./audio-engine";

type DeviceType = "osc" | "output";

type SyntaxDevice = {
  id: string;
  type: DeviceType;
  params?: Record<string, unknown>;
};

type SyntaxRoute = {
  from: string;
  to: string;
  signal: string;
};

type SyntaxPatch = {
  devices?: SyntaxDevice[];
  routes?: SyntaxRoute[];
};

class PatchBuilder {
  build(patchData: SyntaxPatch) {
    if (!audioEngine || !audioEngine.isRunning || !audioEngine.workletReady) {
      throw new Error("Audio engine is not ready");
    }

    const devices = Array.isArray(patchData.devices) ? patchData.devices : [];
    const routes = Array.isArray(patchData.routes) ? patchData.routes : [];

    if (!devices.length) {
      throw new Error("Patch must define at least one device");
    }

    const hasOscillator = devices.some((device) => device.type === "osc");
    const hasOutput = devices.some((device) => device.type === "output");

    if (!hasOscillator || !hasOutput) {
      throw new Error("Patch must include at least one osc and one output");
    }

    if (!routes.length) {
      throw new Error("Patch must define routes");
    }

    audioEngine.sendPatch({ devices, routes });
  }
}

export default PatchBuilder;
