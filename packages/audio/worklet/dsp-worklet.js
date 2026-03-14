const TWO_PI = Math.PI * 2;

class DSPWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = sampleRate;
    this.devices = new Map();
    this.routes = [];
    // Keyed by device type name (e.g. "filter", "eq"). Shared instances —
    // one per type, used by all devices of that type in the patch.
    this.faustInstances = new Map();
    // Keyed by device instance ID (e.g. "osc1", "osc2"). Per-instance WASM
    // — required for osc because each instance has independent phase state.
    this.faustInstancesById = new Map();
    // Single unified output Map — cleared each sample to avoid GC on the audio thread.
    // Topological ordering ensures every device reads only from already-computed upstream outputs.
    this.sampleOutputs = new Map();
    // Processing order computed once per patch by _buildProcessOrder().
    this.processOrder = [];
    // DC blocker state: [left, right]
    this.dcBlockX = [0, 0];
    this.dcBlockY = [0, 0];
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
        this._instantiateFaustDevice(
          payload.name,
          payload.buffer,
          payload.instanceId,
        );
      }
    };
  }

  _instantiateFaustDevice(name, buffer, instanceId) {
    // Param byte offsets derived from the compiled WASM for each device.
    // filter.json: mode=12, drive=28, q=48, cutoff=64  (from compiled filter.json UI index fields)
    // eq.json:     highFreq=12, highGain=128, lowFreq=20, lowGain=52,
    //              midFreq=16, midGain=76, midQ=80
    // osc.json:    gain=262144, wave=262148, freq=262172
    //   (Faust 2.83.1 places the DSP struct at 0x40000 in linear memory)
    const PARAM_OFFSETS = {
      filter: {
        modeByteOffset: 12,
        driveByteOffset: 28,
        qByteOffset: 48,
        cutoffByteOffset: 64,
      },
      eq: {
        lowFreq: 20,
        lowGain: 52,
        midFreq: 16,
        midGain: 76,
        midQ: 80,
        highFreq: 12,
        highGain: 128,
      },
      osc: {
        gainByteOffset: 262144,
        waveByteOffset: 262148,
        freqByteOffset: 262172,
      },
    };

    // wasm-ib format imports: linear memory + single-precision math host functions
    const memory = new WebAssembly.Memory({ initial: 32 });
    const importObject = {
      env: {
        memory,
        _powf: Math.pow,
        _sinf: Math.sin,
        _tanf: Math.tan,
        _tanhf: Math.tanh,
      },
    };
    WebAssembly.instantiate(buffer, importObject)
      .then(({ instance }) => {
        const exp = instance.exports;
        exp.init(0, this.sampleRate);

        // wasm-ib has no malloc export — lay out buffers manually in the imported
        // linear memory at a fixed offset safely past the DSP struct (which sits
        // at offset 0; the largest struct so far is eq at 152 bytes).
        //
        // Layout (byte offsets from 1024):
        //   1024: inputsPtr  — int32[1] pointing to inputBuf
        //   1028: outputsPtr — int32[2] pointing to outBuf0, outBuf1
        //   1040: inputBuf   — float32 input sample slot
        //   1044: outBuf0    — float32 output channel 0
        //   1048: outBuf1    — float32 output channel 1
        const inputsPtr = 1024;
        const outputsPtr = 1028;
        const inputBuf = 1040;
        const outBuf0 = 1044;
        const outBuf1 = 1048;

        const i32 = new Int32Array(memory.buffer);
        i32[inputsPtr / 4] = inputBuf;
        i32[outputsPtr / 4] = outBuf0;
        i32[outputsPtr / 4 + 1] = outBuf1;

        // Cache a typed-array view on the memory buffer — avoids allocating a new
        // Float32Array wrapper every sample inside the render loop.
        const f32 = new Float32Array(memory.buffer);
        const offsets = PARAM_OFFSETS[name] || {};
        const entry = {
          exp,
          memory,
          f32,
          inputBuf,
          outBuf0,
          inputsPtr,
          outputsPtr,
          ...offsets,
          paramOffsets: offsets,
        };
        if (instanceId) {
          this.faustInstancesById.set(instanceId, entry);
          console.log(`[DSPWorklet] Faust ${name} ready: ${instanceId}`);
        } else {
          this.faustInstances.set(name, entry);
          console.log(`[DSPWorklet] Faust ${name} ready (shared)`);
        }
      })
      .catch((err) => {
        console.error(
          `[DSPWorklet] Failed to instantiate Faust device "${name}" (${instanceId ?? "shared"}):`,
          err,
        );
      });
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
        entry.waveIndex =
          { sine: 0, sawtooth: 1, square: 2, triangle: 3, noise: 4 }[
            entry.wave
          ] ?? 0;
      } else if (device.type === "lfo") {
        entry.frequency = Number(params.frequency) || 1;
        entry.depth = Number(params.depth) ?? 0.5;
        entry.wave = (params.wave || "sine").toLowerCase();
      } else if (device.type === "filter") {
        entry.mode = Number(params.mode) || 0;
        entry.cutoff = Number(params.cutoff) || 1000;
        entry.baseCutoff = entry.cutoff;
        entry.q = Number(params.q) || 1.0;
        entry.drive = params.drive != null ? Number(params.drive) : 1.0;
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
        entry.samplesPerStep = this.sampleRate / entry.rate;
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
    this._buildProcessOrder();
  }

  _buildProcessOrder() {
    // Build a dependency map from audio routes: deviceId → Set of upstream device IDs.
    const deps = new Map();
    for (const id of this.devices.keys()) {
      deps.set(id, new Set());
    }
    for (const route of this.routes) {
      if (route.signal !== "audio") continue;
      if (deps.has(route.to)) {
        deps.get(route.to).add(route.from);
      }
    }
    // DFS post-order traversal — a node is appended after all its dependencies,
    // guaranteeing each device is processed only after everything it reads from.
    const sorted = [];
    const visited = new Set();
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const dep of deps.get(id) ?? []) {
        visit(dep);
      }
      sorted.push(id);
    };
    for (const id of this.devices.keys()) {
      visit(id);
    }
    this.processOrder = sorted;
  }

  advanceEnvelope(device) {
    // Exponential RC-style curves: reaches ~99.9% of target within the specified time.
    // Coefficient = 1 - exp(-ln(1000) * dt / time), where ln(1000) ≈ 6.908.
    const dt = 1 / this.sampleRate;
    switch (device.state) {
      case "attack": {
        const coeff = 1 - Math.exp((-6.908 * dt) / device.attack);
        device.value += (1 - device.value) * coeff;
        if (device.value >= 0.999) {
          device.value = 1;
          device.state = "decay";
        }
        break;
      }
      case "decay": {
        const coeff = 1 - Math.exp((-6.908 * dt) / device.decay);
        device.value += (device.sustain - device.value) * coeff;
        if (Math.abs(device.value - device.sustain) < 0.001) {
          device.value = device.sustain;
          device.state = "sustain";
        }
        break;
      }
      case "sustain":
        device.value = device.sustain;
        break;
      case "release": {
        const coeff = 1 - Math.exp((-6.908 * dt) / device.release);
        device.value -= device.value * coeff;
        if (device.value < 0.001) {
          device.value = 0;
          device.state = "idle";
        }
        break;
      }
      default:
        device.value = 0;
    }
    return device.value;
  }

  // PolyBLEP residual for anti-aliasing waveform discontinuities (JS fallback only).
  // t: normalised phase in [0, 1)  dt: normalised phase increment per sample.
  polyBlep(t, dt) {
    if (t < dt) {
      const n = t / dt;
      return n + n - n * n - 1;
    }
    if (t > 1 - dt) {
      const n = (t - 1) / dt;
      return n * n + n + n + 1;
    }
    return 0;
  }

  renderWaveSample(device, applyGain = false) {
    const phase = device.phase || 0;
    const increment = (TWO_PI * (device.frequency || 1)) / this.sampleRate;
    const t = phase / TWO_PI;
    const dt = increment / TWO_PI;
    let sample = 0;
    switch (device.wave) {
      case "noise":
        sample = Math.random() * 2 - 1;
        break;
      case "square": {
        sample = phase < Math.PI ? 1 : -1;
        sample += this.polyBlep(t, dt);
        sample -= this.polyBlep((t + 0.5) % 1, dt);
        break;
      }
      case "sawtooth":
        sample = 2 * t - 1;
        sample -= this.polyBlep(t, dt);
        break;
      case "triangle":
        sample = 2 * Math.abs(2 * t - 1) - 1;
        break;
      case "sine":
      default:
        sample = Math.sin(phase);
        break;
    }
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
        device.sampleClock += 1;
        if (device.sampleClock >= device.samplesPerStep) {
          device.sampleClock -= device.samplesPerStep;
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
            }
          }
        }
      }

      // LFO mod pre-pass: compute each LFO value once, then apply to all targets.
      // Computing per-route would advance phase multiple times for multi-target LFOs.
      const lfoValues = new Map();
      for (const [id, device] of this.devices) {
        if (device.type === "lfo")
          lfoValues.set(id, this.renderWaveSample(device));
      }
      for (const route of this.routes) {
        if (route.signal !== "mod") continue;
        const lfo = this.devices.get(route.from);
        if (!lfo || lfo.type !== "lfo") continue;
        const target = this.devices.get(route.toDevice);
        if (!target) continue;
        const lfoValue = lfoValues.get(route.from) ?? 0;
        if (route.toParam === "frequency" && target.baseFrequency != null) {
          target.frequency =
            target.baseFrequency * (1 + lfoValue * (lfo.depth ?? 0.5));
        } else if (route.toParam === "cutoff" && target.baseCutoff != null) {
          target.cutoff =
            target.baseCutoff * (1 + lfoValue * (lfo.depth ?? 0.5));
        }
      }

      // Unified audio rendering pass — processes devices in topological order so every
      // device reads only from already-computed upstream outputs regardless of type.
      // This replaces the former fixed-order per-type loops and supports arbitrary
      // routing topologies (e.g. channel → filter → out).
      this.sampleOutputs.clear();
      for (const id of this.processOrder) {
        const device = this.devices.get(id);
        if (!device) continue;

        if (device.type === "osc") {
          const fi = this.faustInstancesById.get(id);
          if (!fi) continue;
          fi.f32[fi.freqByteOffset / 4] = device.frequency;
          fi.f32[fi.gainByteOffset / 4] = device.gain;
          fi.f32[fi.waveByteOffset / 4] = device.waveIndex ?? 0;
          fi.exp.compute(0, 1, 0, fi.outputsPtr);
          this.sampleOutputs.set(id, fi.f32[fi.outBuf0 / 4]);
        } else if (device.type === "filter") {
          const fi = this.faustInstancesById.get(id);
          if (!fi) continue;
          let input = 0;
          for (const route of this.routes) {
            if (route.signal !== "audio" || route.to !== id) continue;
            const src = this.sampleOutputs.get(route.from);
            if (src !== undefined) input += src;
          }
          // Set params each sample — LFO may have updated device.cutoff this iteration
          fi.f32[fi.modeByteOffset / 4] = device.mode;
          fi.f32[fi.driveByteOffset / 4] = device.drive ?? 1.0;
          fi.f32[fi.qByteOffset / 4] = device.q;
          fi.f32[fi.cutoffByteOffset / 4] = device.cutoff;
          fi.f32[fi.inputBuf / 4] = input;
          fi.exp.compute(0, 1, fi.inputsPtr, fi.outputsPtr);
          this.sampleOutputs.set(id, fi.f32[fi.outBuf0 / 4]);
        } else if (device.type === "eq") {
          const fi = this.faustInstancesById.get(id);
          if (!fi) continue;
          let input = 0;
          for (const route of this.routes) {
            if (route.signal !== "audio" || route.to !== id) continue;
            const src = this.sampleOutputs.get(route.from);
            if (src !== undefined) input += src;
          }
          fi.f32[fi.paramOffsets.lowFreq / 4] = device.lowFreq;
          fi.f32[fi.paramOffsets.lowGain / 4] = device.lowGain;
          fi.f32[fi.paramOffsets.midFreq / 4] = device.midFreq;
          fi.f32[fi.paramOffsets.midGain / 4] = device.midGain;
          fi.f32[fi.paramOffsets.midQ / 4] = device.midQ;
          fi.f32[fi.paramOffsets.highFreq / 4] = device.highFreq;
          fi.f32[fi.paramOffsets.highGain / 4] = device.highGain;
          fi.f32[fi.inputBuf / 4] = input;
          fi.exp.compute(0, 1, fi.inputsPtr, fi.outputsPtr);
          this.sampleOutputs.set(id, fi.f32[fi.outBuf0 / 4]);
        } else if (device.type === "channel") {
          let input = 0;
          for (const route of this.routes) {
            if (route.signal !== "audio" || route.to !== id) continue;
            const src = this.sampleOutputs.get(route.from);
            if (src !== undefined) input += src;
          }
          this.sampleOutputs.set(id, input * (device.gain ?? 1));
        } else if (device.type === "envelope") {
          const envValue = this.advanceEnvelope(device);
          let input = 0;
          for (const route of this.routes) {
            if (route.signal !== "audio" || route.to !== id) continue;
            const src = this.sampleOutputs.get(route.from);
            if (src !== undefined) input += src;
          }
          this.sampleOutputs.set(id, input * envValue);
        }
        // lfo, sequencer, output: handled in pre-passes or final accumulation below
      }

      // Accumulate final output
      let left = 0;
      let right = 0;
      for (const route of this.routes) {
        if (route.signal !== "audio") continue;
        const destination = this.devices.get(route.to);
        if (!destination || destination.type !== "output") continue;
        const gain = destination.gain ?? 1;
        const sample = this.sampleOutputs.get(route.from);
        if (sample === undefined) continue;
        const srcDevice = this.devices.get(route.from);
        if (srcDevice?.type === "channel") {
          // Constant-power panning: pan ∈ [-1, 1] → angle ∈ [0, π/2]
          const angle = (((srcDevice.pan ?? 0) + 1) * Math.PI) / 4;
          left += sample * Math.cos(angle) * gain;
          right += sample * Math.sin(angle) * gain;
        } else {
          left += sample * gain;
          right += sample * gain;
        }
      }
      // DC blocker (first-order IIR) — removes offset accumulation from filter+LFO chains
      const dcLeft = left - this.dcBlockX[0] + 0.995 * this.dcBlockY[0];
      this.dcBlockX[0] = left;
      this.dcBlockY[0] = dcLeft;
      const dcRight = right - this.dcBlockX[1] + 0.995 * this.dcBlockY[1];
      this.dcBlockX[1] = right;
      this.dcBlockY[1] = dcRight;
      // tanh soft limiter — approaches ±1 asymptotically, preventing hard digital clipping
      leftChannel[i] = Math.tanh(dcLeft);
      rightChannel[i] = Math.tanh(dcRight);
    }
    return true;
  }
}

registerProcessor("dsp-worklet", DSPWorkletProcessor);
