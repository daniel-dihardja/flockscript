declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

class AudioEngine {
  audioContext: AudioContext | null = null;
  workletNode: AudioWorkletNode | null = null;
  workletReady = false;
  useWorklet = true;
  isRunning = false;
  private oscWasmBuffer: ArrayBuffer | null = null;
  private filterWasmBuffer: ArrayBuffer | null = null;
  private eqWasmBuffer: ArrayBuffer | null = null;

  async init() {
    if (this.audioContext) {
      await this.resume();
      return this.audioContext;
    }

    this.audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    await this.loadWorklet();
    this.isRunning = true;
    return this.audioContext;
  }

  async resume() {
    if (!this.audioContext) {
      return;
    }
    await this.audioContext.resume();
  }

  async loadWorklet() {
    if (!this.audioContext || !this.audioContext.audioWorklet) {
      this.useWorklet = false;
      return;
    }
    try {
      const workletUrl = new URL("../worklet/dsp-worklet.js", import.meta.url);
      await this.audioContext.audioWorklet.addModule(workletUrl);
      this.workletNode = new AudioWorkletNode(this.audioContext, "dsp-worklet");
      this.workletNode.connect(this.audioContext.destination);
      this.workletNode.port.onmessage = (event) =>
        this.handleWorkletMessage(event);
      this.workletNode.port.postMessage({ type: "ping" });
    } catch (error) {
      console.warn("[Worklet] Failed to load worklet module:", error);
      this.useWorklet = false;
    }
  }

  handleWorkletMessage(event: MessageEvent) {
    const payload = event.data;
    if (payload?.type === "status") {
      if (payload.message === "worklet-ready") {
        this.workletReady = true;
      }
    }
  }

  async loadFaustDevice(name: string, wasmUrl: URL) {
    if (!this.workletNode) return;
    try {
      const resp = await fetch(wasmUrl);
      const buffer = await resp.arrayBuffer();
      // Transfer the ArrayBuffer (zero-copy) — it becomes detached on this side
      this.workletNode.port.postMessage(
        { type: "loadFaustDevice", name, buffer },
        [buffer],
      );
    } catch (err) {
      console.warn(`[AudioEngine] Failed to load Faust device "${name}":`, err);
    }
  }

  sendPatch(patch: unknown) {
    if (!this.workletReady || !this.workletNode) {
      return;
    }
    this.workletNode.port.postMessage({ type: "setPatch", patch });
    void this.loadOscInstances(patch);
    void this.loadFilterInstances(patch);
    void this.loadEqInstances(patch);
  }

  private async loadOscInstances(patch: unknown) {
    if (!this.workletNode) return;
    const devices = (patch as { devices?: { id: string; type: string }[] })
      ?.devices;
    if (!Array.isArray(devices)) return;
    const oscDevices = devices.filter((d) => d?.type === "osc" && d?.id);
    if (oscDevices.length === 0) return;
    try {
      if (!this.oscWasmBuffer) {
        const resp = await fetch(
          new URL("../public/faust/osc.wasm", import.meta.url),
        );
        this.oscWasmBuffer = await resp.arrayBuffer();
      }
      for (const device of oscDevices) {
        // Each postMessage transfer detaches the buffer, so slice a fresh copy per instance.
        const buf = this.oscWasmBuffer.slice();
        this.workletNode.port.postMessage(
          {
            type: "loadFaustDevice",
            name: "osc",
            instanceId: device.id,
            buffer: buf,
          },
          [buf],
        );
      }
    } catch (err) {
      console.warn("[AudioEngine] Failed to load Faust osc instances:", err);
    }
  }

  private async loadFilterInstances(patch: unknown) {
    if (!this.workletNode) return;
    const devices = (patch as { devices?: { id: string; type: string }[] })
      ?.devices;
    if (!Array.isArray(devices)) return;
    const targets = devices.filter((d) => d?.type === "filter" && d?.id);
    if (targets.length === 0) return;
    try {
      if (!this.filterWasmBuffer) {
        const resp = await fetch(
          new URL("../public/faust/filter.wasm", import.meta.url),
        );
        this.filterWasmBuffer = await resp.arrayBuffer();
      }
      for (const device of targets) {
        const buf = this.filterWasmBuffer.slice();
        this.workletNode.port.postMessage(
          {
            type: "loadFaustDevice",
            name: "filter",
            instanceId: device.id,
            buffer: buf,
          },
          [buf],
        );
      }
    } catch (err) {
      console.warn("[AudioEngine] Failed to load Faust filter instances:", err);
    }
  }

  private async loadEqInstances(patch: unknown) {
    if (!this.workletNode) return;
    const devices = (patch as { devices?: { id: string; type: string }[] })
      ?.devices;
    if (!Array.isArray(devices)) return;
    const targets = devices.filter((d) => d?.type === "eq" && d?.id);
    if (targets.length === 0) return;
    try {
      if (!this.eqWasmBuffer) {
        const resp = await fetch(
          new URL("../public/faust/eq.wasm", import.meta.url),
        );
        this.eqWasmBuffer = await resp.arrayBuffer();
      }
      for (const device of targets) {
        const buf = this.eqWasmBuffer.slice();
        this.workletNode.port.postMessage(
          {
            type: "loadFaustDevice",
            name: "eq",
            instanceId: device.id,
            buffer: buf,
          },
          [buf],
        );
      }
    } catch (err) {
      console.warn("[AudioEngine] Failed to load Faust eq instances:", err);
    }
  }

  triggerEnvelope(deviceId: string) {
    this.workletNode?.port.postMessage({ type: "trigger", deviceId });
  }

  releaseEnvelope(deviceId: string) {
    this.workletNode?.port.postMessage({ type: "release", deviceId });
  }

  silence() {
    if (!this.audioContext || !this.isRunning) {
      return;
    }
    this.sendPatch({ devices: [], routes: [] });
  }

  getDebugStatus() {
    return {
      contextState: this.audioContext?.state ?? "unknown",
      sampleRate: this.audioContext?.sampleRate ?? 0,
      isRunning: this.isRunning,
      useWorklet: this.useWorklet,
      workletReady: this.workletReady,
    };
  }
}

const audioEngine = new AudioEngine();
export default audioEngine;
