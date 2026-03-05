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

  async init() {
    if (this.audioContext) {
      await this.resume();
      return this.audioContext;
    }

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
      this.workletNode.port.onmessage = (event) => this.handleWorkletMessage(event);
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

  sendPatch(patch: unknown) {
    if (!this.workletReady || !this.workletNode) {
      return;
    }
    this.workletNode.port.postMessage({ type: "setPatch", patch });
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

  silence() {
    if (!this.audioContext || !this.isRunning) {
      return;
    }
    this.sendPatch({ devices: [], routes: [] });
  }
}

const audioEngine = new AudioEngine();
export default audioEngine;
