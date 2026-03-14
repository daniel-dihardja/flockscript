const TWO_PI = Math.PI * 2;

class DSPWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = sampleRate;
    this.devices = new Map();
    this.routes = [];
    // Keyed by device name (e.g. "filter"). Each entry holds the WASM exports
    // and pre-allocated buffer pointers for block-oriented compute() calls.
    this.faustInstances = new Map();
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
      if (payload.type === "trigger") {
        const device = this.devices.get(payload.deviceId);
        if (device?.type === "envelope") {
          device.state = "attack";
          device.value = 0;
        }
      }
      if (payload.type === "release") {
        const device = this.devices.get(payload.deviceId);
        if (device?.type === "envelope") {
          device.releaseStartValue = device.value;
          device.state = "release";
        }
      }
      if (payload.type === "loadFaustDevice") {
        this._instantiateFaustDevice(payload.name, payload.buffer);
      }
    };
  }

  _instantiateFaustDevice(name, buffer) {
    // wasm-ib format imports: linear memory + single-precision math host functions
    const memory = new WebAssembly.Memory({ initial: 32 });
    const importObject = {
      env: {
        memory,
        _powf: Math.pow,
        _tanf: Math.tan,
      },
    };
    WebAssembly.instantiate(buffer, importObject).then(({ instance }) => {
      const exp = instance.exports;
      exp.init(0, this.sampleRate);

      // wasm-ib has no malloc export — lay out buffers manually in the imported
      // linear memory at a fixed offset safely past the DSP struct (which sits
      // at offset 0 and is at most a few hundred bytes for a biquad filter).
      //
      // Layout (byte offsets from 1024):
      //   1024: inputsPtr  — int32[1] pointing to inputBuf
      //   1028: outputsPtr — int32[2] pointing to outBuf0, outBuf1
      //   1040: inputBuf   — float32 input sample slot
      //   1044: outBuf0    — float32 output channel 0
      //   1048: outBuf1    — float32 output channel 1
      const inputsPtr  = 1024;
      const outputsPtr = 1028;
      const inputBuf   = 1040;
      const outBuf0    = 1044;
      const outBuf1    = 1048;

      const i32 = new Int32Array(memory.buffer);
      i32[inputsPtr  / 4]     = inputBuf;
      i32[outputsPtr / 4]     = outBuf0;
      i32[outputsPtr / 4 + 1] = outBuf1;

      // Param byte offsets from filter.json: mode=0, q=4, cutoff=16
      this.faustInstances.set(name, {
        exp, memory, inputBuf, outBuf0, inputsPtr, outputsPtr,
        modeByteOffset: 0, qByteOffset: 4, cutoffByteOffset: 16,
      });
    }).catch((err) => {
      console.error(`[DSPWorklet] Failed to instantiate Faust device "${name}":`, err);
    });
  }

  // Separate state object version used by multi-stage EQ
  applyBiquadState(state, coeffs, x) {
    const { b0, b1, b2, a1, a2 } = coeffs;
    const y =
      b0 * x + b1 * state.x1 + b2 * state.x2 - a1 * state.y1 - a2 * state.y2;
    state.x2 = state.x1;
    state.x1 = x;
    state.y2 = state.y1;
    state.y1 = y;
    return y;
  }

  // Low/high shelf coefficients (RBJ Audio EQ Cookbook, S = 1)
  computeShelfCoeffs(type, freq, gainDb) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = (TWO_PI * freq) / this.sampleRate;
    const cosw0 = Math.cos(w0);
    // With shelf slope S=1: alpha = sin(w0)/sqrt(2)
    const alphaS = Math.sin(w0) / Math.SQRT2;
    const sqA = Math.sqrt(A);
    let b0, b1, b2, a0, a1, a2;
    if (type === "highshelf") {
      b0 = A * (A + 1 + (A - 1) * cosw0 + 2 * sqA * alphaS);
      b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
      b2 = A * (A + 1 + (A - 1) * cosw0 - 2 * sqA * alphaS);
      a0 = A + 1 - (A - 1) * cosw0 + 2 * sqA * alphaS;
      a1 = 2 * (A - 1 - (A + 1) * cosw0);
      a2 = A + 1 - (A - 1) * cosw0 - 2 * sqA * alphaS;
    } else {
      // lowshelf
      b0 = A * (A + 1 - (A - 1) * cosw0 + 2 * sqA * alphaS);
      b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
      b2 = A * (A + 1 - (A - 1) * cosw0 - 2 * sqA * alphaS);
      a0 = A + 1 + (A - 1) * cosw0 + 2 * sqA * alphaS;
      a1 = -2 * (A - 1 + (A + 1) * cosw0);
      a2 = A + 1 + (A - 1) * cosw0 - 2 * sqA * alphaS;
    }
    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0,
    };
  }

  // Peaking EQ band coefficients (RBJ Audio EQ Cookbook)
  computePeakCoeffs(freq, gainDb, q) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = (TWO_PI * freq) / this.sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);
    const a0 = 1 + alpha / A;
    return {
      b0: (1 + alpha * A) / a0,
      b1: (-2 * cosw0) / a0,
      b2: (1 - alpha * A) / a0,
      a1: (-2 * cosw0) / a0,
      a2: (1 - alpha / A) / a0,
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
      } else if (device.type === "filter") {
        entry.filterType = params.filterType || "lowpass";
        entry.mode = entry.filterType === "highpass" ? 1 : 0;
        entry.cutoff = Number(params.cutoff) || 1000;
        entry.baseCutoff = entry.cutoff;
        entry.q = Number(params.q) || 1.0;
      } else if (device.type === "envelope") {
        entry.attack = Number(params.attack) || 0.01;
        entry.decay = Number(params.decay) || 0.1;
        entry.sustain = params.sustain != null ? Number(params.sustain) : 0.7;
        entry.release = Number(params.release) || 0.3;
        entry.state = "attack";
        entry.value = 0;
        entry.releaseStartValue = 0;
      } else if (device.type === "sequencer") {
        entry.steps = Array.isArray(params.steps)
          ? params.steps.map(Number)
          : [220, 330, 440, 330];
        entry.rate = Number(params.rate) || 4;
        entry.currentStep = 0;
        entry.sampleClock = 0;
      } else if (device.type === "eq") {
        entry.lowFreq = Number(params.lowFreq) || 200;
        entry.lowGain = params.lowGain != null ? Number(params.lowGain) : 0;
        entry.midFreq = Number(params.midFreq) || 1000;
        entry.midGain = params.midGain != null ? Number(params.midGain) : 0;
        entry.midQ = Number(params.midQ) || 1.0;
        entry.highFreq = Number(params.highFreq) || 4000;
        entry.highGain = params.highGain != null ? Number(params.highGain) : 0;
        entry.lowState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        entry.midState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        entry.highState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        entry.lowCoeffs = this.computeShelfCoeffs(
          "lowshelf",
          entry.lowFreq,
          entry.lowGain,
        );
        entry.midCoeffs = this.computePeakCoeffs(
          entry.midFreq,
          entry.midGain,
          entry.midQ,
        );
        entry.highCoeffs = this.computeShelfCoeffs(
          "highshelf",
          entry.highFreq,
          entry.highGain,
        );
      } else if (device.type === "output") {
        entry.gain = Number(params.gain) || 1.0;
      } else if (device.type === "channel") {
        entry.gain = params.gain != null ? Number(params.gain) : 1.0;
        entry.pan = params.pan != null ? Number(params.pan) : 0;
      }
      this.devices.set(device.id, entry);
    });

    this.routes = (patch?.routes || [])
      .map((route) => {
        if (!route?.from || !route?.to) return null;
        const from = route.from.split(".")[0];
        const signal = route.signal || "audio";
        if (signal === "mod" || signal === "seq") {
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

  advanceEnvelope(device) {
    const dt = 1 / this.sampleRate;
    switch (device.state) {
      case "attack":
        device.value += dt / device.attack;
        if (device.value >= 1) {
          device.value = 1;
          device.state = "decay";
        }
        break;
      case "decay":
        device.value -= (dt * (1 - device.sustain)) / device.decay;
        if (device.value <= device.sustain) {
          device.value = device.sustain;
          device.state = "sustain";
        }
        break;
      case "sustain":
        device.value = device.sustain;
        break;
      case "release":
        device.value -= (dt * device.releaseStartValue) / device.release;
        if (device.value <= 0) {
          device.value = 0;
          device.state = "idle";
        }
        break;
      default:
        device.value = 0;
    }
    return device.value;
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
      // Sequencer pre-pass: advance step clock, write frequency/gate to targets
      for (const [, device] of this.devices) {
        if (device.type !== "sequencer") continue;
        const samplesPerStep = this.sampleRate / device.rate;
        device.sampleClock += 1;
        if (device.sampleClock >= samplesPerStep) {
          device.sampleClock -= samplesPerStep;
          device.currentStep = (device.currentStep + 1) % device.steps.length;
          const freq = device.steps[device.currentStep];
          for (const route of this.routes) {
            if (route.signal !== "seq" || route.from !== device.id) continue;
            const target = this.devices.get(route.toDevice);
            if (!target) continue;
            if (route.toParam === "frequency" && freq != null) {
              target.frequency = freq;
              target.baseFrequency = freq;
            } else if (route.toParam === "gate" && target.type === "envelope") {
              target.releaseStartValue = target.value;
              target.state = "attack";
              target.value = 0;
            }
          }
        }
      }

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
        } else if (route.toParam === "cutoff" && target.baseCutoff != null) {
          target.cutoff =
            target.baseCutoff * (1 + lfoValue * (lfo.depth ?? 0.5));
        }
      }

      // Render each osc once per sample to avoid phase double-advance
      const oscOutputs = new Map();
      for (const [id, device] of this.devices) {
        if (device.type === "osc") {
          oscOutputs.set(id, this.renderWaveSample(device, true));
        }
      }

      // Process filters via Faust WASM — compute one sample at a time
      const filterOutputs = new Map();
      for (const [id, device] of this.devices) {
        if (device.type !== "filter") continue;
        const fi = this.faustInstances.get("filter");
        if (!fi) continue;
        let filterIn = 0;
        for (const route of this.routes) {
          if (route.signal !== "audio" || route.to !== id) continue;
          const src = oscOutputs.get(route.from);
          if (src !== undefined) filterIn += src;
        }
        const f32 = new Float32Array(fi.memory.buffer);
        // Set params each sample — LFO may have updated device.cutoff this iteration
        f32[fi.modeByteOffset   / 4] = device.mode;
        f32[fi.qByteOffset      / 4] = device.q;
        f32[fi.cutoffByteOffset / 4] = device.cutoff;
        // Write input sample, run DSP for count=1, read scalar output
        f32[fi.inputBuf / 4] = filterIn;
        fi.exp.compute(0, 1, fi.inputsPtr, fi.outputsPtr);
        filterOutputs.set(id, f32[fi.outBuf0 / 4]);
      }

      // Process channels: sum osc/filter inputs and apply channel gain.
      // Channels are resolved before EQ and envelope so they can feed downstream stages.
      const channelOutputs = new Map();
      for (const [id, device] of this.devices) {
        if (device.type !== "channel") continue;
        let sum = 0;
        for (const route of this.routes) {
          if (route.signal !== "audio" || route.to !== id) continue;
          const src =
            oscOutputs.get(route.from) ?? filterOutputs.get(route.from);
          if (src !== undefined) sum += src;
        }
        channelOutputs.set(id, sum * (device.gain ?? 1));
      }

      // Process EQ: accumulate inputs, apply 3-stage biquad (low shelf, peak, high shelf)
      const eqOutputs = new Map();
      for (const [id, device] of this.devices) {
        if (device.type !== "eq") continue;
        let eqIn = 0;
        for (const route of this.routes) {
          if (route.signal !== "audio" || route.to !== id) continue;
          const src =
            oscOutputs.get(route.from) ??
            filterOutputs.get(route.from) ??
            channelOutputs.get(route.from);
          if (src !== undefined) eqIn += src;
        }
        let s = this.applyBiquadState(device.lowState, device.lowCoeffs, eqIn);
        s = this.applyBiquadState(device.midState, device.midCoeffs, s);
        s = this.applyBiquadState(device.highState, device.highCoeffs, s);
        eqOutputs.set(id, s);
      }

      // Process envelopes: advance ADSR state, multiply incoming audio by envelope value
      const envelopeOutputs = new Map();
      for (const [id, device] of this.devices) {
        if (device.type !== "envelope") continue;
        const envValue = this.advanceEnvelope(device);
        let envIn = 0;
        for (const route of this.routes) {
          if (route.signal !== "audio" || route.to !== id) continue;
          const src =
            oscOutputs.get(route.from) ??
            filterOutputs.get(route.from) ??
            channelOutputs.get(route.from) ??
            eqOutputs.get(route.from);
          if (src !== undefined) envIn += src;
        }
        envelopeOutputs.set(id, envIn * envValue);
      }

      // Accumulate output: direct osc→output and filter→output routes
      let left = 0;
      let right = 0;
      for (const route of this.routes) {
        if (route.signal !== "audio") continue;
        const destination = this.devices.get(route.to);
        if (!destination || destination.type !== "output") continue;
        const gain = destination.gain ?? 1;

        const oscSample = oscOutputs.get(route.from);
        if (oscSample !== undefined) {
          left += oscSample * gain;
          right += oscSample * gain;
          continue;
        }

        const filterSample = filterOutputs.get(route.from);
        if (filterSample !== undefined) {
          left += filterSample * gain;
          right += filterSample * gain;
          continue;
        }

        const eqSample = eqOutputs.get(route.from);
        if (eqSample !== undefined) {
          left += eqSample * gain;
          right += eqSample * gain;
          continue;
        }

        const envSample = envelopeOutputs.get(route.from);
        if (envSample !== undefined) {
          left += envSample * gain;
          right += envSample * gain;
          continue;
        }

        const channelSample = channelOutputs.get(route.from);
        if (channelSample !== undefined) {
          left += channelSample * gain;
          right += channelSample * gain;
        }
      }
      leftChannel[i] = left;
      rightChannel[i] = right;
    }
    return true;
  }
}

registerProcessor("dsp-worklet", DSPWorkletProcessor);
