declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

class AudioEngine {
  audioContext: AudioContext | null = null;
  workletNode: AudioWorkletNode | null = null;
  analyserNode: AnalyserNode | null = null;
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
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.workletNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);
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

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;

  startRecording() {
    if (!this.audioContext || !this.analyserNode) return;
    this.mediaStreamDest = this.audioContext.createMediaStreamDestination();
    this.analyserNode.connect(this.mediaStreamDest);
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaStreamDest.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.audioContext) {
        reject(new Error("Not recording"));
        return;
      }
      this.mediaRecorder.onstop = async () => {
        try {
          if (this.mediaStreamDest) {
            this.analyserNode?.disconnect(this.mediaStreamDest);
            this.mediaStreamDest = null;
          }
          const webmBlob = new Blob(this.recordedChunks, {
            type: "audio/webm",
          });
          const arrayBuffer = await webmBlob.arrayBuffer();
          const audioBuffer =
            await this.audioContext!.decodeAudioData(arrayBuffer);
          const wavBuffer = encodeWav(audioBuffer);
          resolve(new Blob([wavBuffer], { type: "audio/wav" }));
        } catch (err) {
          reject(err);
        }
      };
      this.mediaRecorder.stop();
    });
  }
}

function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numChannels }, (_, i) =>
    audioBuffer.getChannelData(i),
  );
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]![i]!));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

const audioEngine = new AudioEngine();
export type { AudioEngine };
export default audioEngine;
