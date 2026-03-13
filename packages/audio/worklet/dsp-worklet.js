const TWO_PI = Math.PI * 2;

class DSPWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = sampleRate;
    this.devices = new Map();
    this.routes = [];
    this.port.onmessage = (event) => {
      const payload = event.data;
      if (!payload) return;
      if (payload.type === "ping") {
        this.port.postMessage({ type: "status", message: "worklet-ready" });
        return;
      }
      if (payload.type === "setPatch") {
        this.applyPatch(payload.patch);
      }
    };
  }

  applyPatch(patch) {
    this.devices.clear();
    (patch?.devices || []).forEach((device) => {
      if (!device?.id || !device?.type) {
        return;
      }
      const params = device.params || {};
      const entry = {
        id: device.id,
        type: device.type,
        params,
        phase: 0,
      };
      if (device.type === "osc") {
        entry.frequency = Number(params.frequency) || 440;
        entry.baseFrequency = Number(params.frequency) || 440;
        entry.gain = Number(params.gain) || 0.5;
        entry.wave = (params.wave || "sine").toLowerCase();
      } else if (device.type === "lfo") {
        entry.frequency = Number(params.frequency) || 1;
        entry.depth = Number(params.depth) ?? 0.5;
        entry.wave = (params.wave || "sine").toLowerCase();
      } else if (device.type === "output") {
        entry.gain = Number(params.gain) || 1.0;
      }
      this.devices.set(device.id, entry);
    });

    this.routes = (patch?.routes || [])
      .map((route) => {
        if (!route?.from || !route?.to) return null;
        const from = route.from.split(".")[0];
        const signal = route.signal || "audio";
        if (signal === "mod") {
          const dotIndex = route.to.indexOf(".");
          const toDevice =
            dotIndex >= 0 ? route.to.slice(0, dotIndex) : route.to;
          const toParam = dotIndex >= 0 ? route.to.slice(dotIndex + 1) : "";
          return { from, toDevice, toParam, signal };
        }
        const to = route.to.split(".")[0];
        return { from, to, signal };
      })
      .filter(Boolean);
  }

  renderWaveSample(device, applyGain = false) {
    const phase = device.phase || 0;
    let sample = 0;
    switch (device.wave) {
      case "noise":
        sample = Math.random() * 2 - 1;
        break;
      case "square":
        sample = phase < Math.PI ? 1 : -1;
        break;
      case "sawtooth":
        sample = 2 * (phase / TWO_PI) - 1;
        break;
      case "triangle":
        sample = 2 * Math.abs(2 * (phase / TWO_PI) - 1) - 1;
        break;
      case "sine":
      default:
        sample = Math.sin(phase);
        break;
    }
    const increment = (TWO_PI * (device.frequency || 1)) / this.sampleRate;
    device.phase = (phase + increment) % TWO_PI;
    return applyGain ? sample * (device.gain || 0) : sample;
  }

  process(_, outputs) {
    const output = outputs[0];
    if (!output || !output.length) {
      return true;
    }
    const leftChannel = output[0];
    const rightChannel = output[1] || output[0];
    for (let i = 0; i < leftChannel.length; i += 1) {
      // LFO mod pre-pass: apply modulation before audio rendering
      for (const route of this.routes) {
        if (route.signal !== "mod") continue;
        const lfo = this.devices.get(route.from);
        if (!lfo || lfo.type !== "lfo") continue;
        const target = this.devices.get(route.toDevice);
        if (!target) continue;
        const lfoValue = this.renderWaveSample(lfo);
        if (route.toParam === "frequency" && target.baseFrequency != null) {
          target.frequency =
            target.baseFrequency * (1 + lfoValue * (lfo.depth ?? 0.5));
        }
      }

      let left = 0;
      let right = 0;
      for (const route of this.routes) {
        if (route.signal !== "audio") {
          continue;
        }
        const source = this.devices.get(route.from);
        const destination = this.devices.get(route.to);
        if (!source || source.type !== "osc" || !destination) {
          continue;
        }
        const contribution = this.renderWaveSample(source, true);
        const gain = destination.gain ?? 1;
        left += contribution * gain;
        right += contribution * gain;
      }
      leftChannel[i] = left;
      rightChannel[i] = right;
    }
    return true;
  }
}

registerProcessor("dsp-worklet", DSPWorkletProcessor);
