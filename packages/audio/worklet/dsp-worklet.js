class BiquadFilter {
  constructor(type, sampleRate) {
    this.type = type || "lowpass";
    this.sampleRate = sampleRate;
    this.freq = 1000;
    this.q = 1;
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  update(type, freq, q) {
    if (type) {
      this.type = type;
    }
    const f = Math.max(20, Math.min(this.sampleRate * 0.45, freq || 1000));
    const qv = Math.max(0.1, q || 1);

    if (f === this.freq && qv === this.q) {
      return;
    }

    this.freq = f;
    this.q = qv;

    const w0 = (2 * Math.PI * f) / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * qv);

    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;

    switch (this.type) {
      case "highpass":
        b0 = (1 + cosw0) / 2;
        b1 = -(1 + cosw0);
        b2 = (1 + cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;
      case "bandpass":
        b0 = sinw0 / 2;
        b1 = 0;
        b2 = -sinw0 / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;
      case "notch":
        b0 = 1;
        b1 = -2 * cosw0;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;
      case "lowpass":
      default:
        b0 = (1 - cosw0) / 2;
        b1 = 1 - cosw0;
        b2 = (1 - cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;
    }

    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  process(sample) {
    const y =
      this.b0 * sample +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2;

    this.x2 = this.x1;
    this.x1 = sample;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

class DelayLine {
  constructor(sampleRate, maxTime = 2) {
    this.sampleRate = sampleRate;
    this.maxSamples = Math.floor(sampleRate * maxTime);
    this.bufferL = new Float32Array(this.maxSamples);
    this.bufferR = new Float32Array(this.maxSamples);
    this.writeIndex = 0;
    this.time = 0.25;
    this.feedback = 0.4;
  }

  update(time, feedback) {
    this.time = Math.max(0, Math.min(2, time || this.time));
    this.feedback = Math.max(0, Math.min(0.95, feedback ?? this.feedback));
  }

  process(l, r) {
    const delaySamples = this.time * this.sampleRate;
    const readIndex =
      (this.writeIndex - delaySamples + this.maxSamples) % this.maxSamples;
    const idx0 = Math.floor(readIndex);
    const idx1 = (idx0 + 1) % this.maxSamples;
    const frac = readIndex - idx0;

    const dl = this.bufferL[idx0] * (1 - frac) + this.bufferL[idx1] * frac;
    const dr = this.bufferR[idx0] * (1 - frac) + this.bufferR[idx1] * frac;

    this.bufferL[this.writeIndex] = l + dl * this.feedback;
    this.bufferR[this.writeIndex] = r + dr * this.feedback;
    this.writeIndex = (this.writeIndex + 1) % this.maxSamples;

    return [l + dl, r + dr];
  }
}

class Compressor {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.threshold = -24; // dB
    this.ratio = 4; // 4:1
    this.attack = 0.003; // seconds
    this.release = 0.25; // seconds
    this.knee = 0; // dB
    this.makeup = 0; // dB
    this.envelope = 0;

    // Convert times to coefficients
    this.attackCoeff = Math.exp(-1 / (this.attack * sampleRate));
    this.releaseCoeff = Math.exp(-1 / (this.release * sampleRate));
  }

  update(threshold, ratio, attack, release, knee, makeup) {
    this.threshold = threshold ?? this.threshold;
    this.ratio = Math.max(1, ratio ?? this.ratio);
    this.knee = Math.max(0, knee ?? this.knee);
    this.makeup = makeup ?? this.makeup;

    const newAttack = Math.max(0.001, attack ?? this.attack);
    const newRelease = Math.max(0.001, release ?? this.release);

    if (newAttack !== this.attack) {
      this.attack = newAttack;
      this.attackCoeff = Math.exp(-1 / (this.attack * this.sampleRate));
    }

    if (newRelease !== this.release) {
      this.release = newRelease;
      this.releaseCoeff = Math.exp(-1 / (this.release * this.sampleRate));
    }
  }

  process(sample) {
    // Convert to dB
    const inputDb = 20 * Math.log10(Math.abs(sample) + 1e-10);

    // Calculate gain reduction
    let gainReduction = 0;

    if (this.knee > 0) {
      // Soft knee
      const kneeStart = this.threshold - this.knee / 2;
      const kneeEnd = this.threshold + this.knee / 2;

      if (inputDb > kneeEnd) {
        gainReduction = (inputDb - this.threshold) * (1 - 1 / this.ratio);
      } else if (inputDb > kneeStart) {
        const kneeRange = inputDb - kneeStart;
        const kneeWidth = this.knee;
        gainReduction =
          ((kneeRange * kneeRange) / (2 * kneeWidth)) * (1 - 1 / this.ratio);
      }
    } else {
      // Hard knee
      if (inputDb > this.threshold) {
        gainReduction = (inputDb - this.threshold) * (1 - 1 / this.ratio);
      }
    }

    // Envelope follower with attack/release
    const targetGain = -gainReduction;
    const coeff =
      targetGain < this.envelope ? this.attackCoeff : this.releaseCoeff;
    this.envelope = targetGain + coeff * (this.envelope - targetGain);

    // Convert back to linear and apply makeup gain
    const gainLinear = Math.pow(10, (this.envelope + this.makeup) / 20);

    return sample * gainLinear;
  }
}

class DSPWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.patch = { oscillators: [], noise: [], modulators: [], routing: [] };
    this.sampleRate = sampleRate;
    this.oscillators = [];
    this.noise = [];
    this.modulators = [];
    this.routing = [];
    this.routingMap = new Map();
    this.effects = [];
    this.effectState = [];
    this.voices = [];
    this.voiceState = new Map();
    this.activeNotes = [];

    // Output safety limiter
    this.limiterThreshold = 0.95;
    this.limiterGain = 1.0;
    this.limiterRelease = 0.9995;

    this.port.onmessage = (event) => {
      if (event.data?.type === "test") {
      }
      if (event.data?.type === "setPatch") {
        this.applyPatch(event.data.patch || {});
      }
      if (event.data?.type === "ping") {
        this.port.postMessage({ type: "status", message: "worklet-ready" });
      }
    };
  }

  applyPatch(patch) {
    this.patch = patch;

    this.oscillators = (patch.oscillators || []).map((osc) => {
      const freq = typeof osc.freq === "number" ? osc.freq : 440;
      const gain = typeof osc.gain === "number" ? osc.gain : 0.2;
      const pan = typeof osc.pan === "number" ? osc.pan : 0;
      const type = osc.type || "sine";
      const detune = typeof osc.detune === "number" ? osc.detune : 0;
      return {
        id: osc.id || `osc_${Math.random()}`,
        type,
        freq,
        gain,
        pan,
        detune,
        phase: 0,
      };
    });

    this.noise = (patch.noise || []).map((n) => {
      const gain = typeof n.gain === "number" ? n.gain : 0.1;
      const pan = typeof n.pan === "number" ? n.pan : 0;
      return { id: n.id || `noise_${Math.random()}`, gain, pan };
    });

    this.modulators = (patch.modulators || []).map((mod) => {
      const type = mod.type;
      let initialValue = 0;
      if (type === "sampleHold") {
        initialValue = ((mod.min ?? -1) + (mod.max ?? 1)) / 2;
      } else if (type === "chaos") {
        initialValue = mod.center ?? 0;
      }
      return {
        id: mod.id || `mod_${Math.random()}`,
        type,
        rate: mod.rate ?? 1,
        depth: mod.depth ?? 0,
        wave: mod.wave || "sine",
        min: mod.min ?? -1,
        max: mod.max ?? 1,
        center: mod.center ?? 0,
        range: mod.range ?? 1,
        step: mod.step ?? 0.2,
        phase: 0,
        value: initialValue,
        lastUpdate: 0,
      };
    });

    const normalizeParam = (param) => {
      if (!param) return param;
      const lower = param.toLowerCase();
      if (lower === "freq" || lower === "frq") {
        return "frequency";
      }
      return lower;
    };
    this.routing = (patch.routing || []).map((route) => ({
      ...route,
      param: normalizeParam(route.param),
    }));
    this.routingMap = new Map();
    this.routing.forEach((route) => {
      if (!route?.from || !route?.to || !route?.param) return;
      const key = `${route.to}:${route.param}`;
      if (!this.routingMap.has(key)) {
        this.routingMap.set(key, []);
      }
      this.routingMap.get(key).push(route.from);
    });

    this.effects = (patch.effects || []).map((effect) => ({
      ...effect,
      id: effect.id || `fx_${Math.random()}`,
    }));
    this.effectState = this.effects.map((effect) => {
      if (effect.type === "filter") {
        return new BiquadFilter(
          effect.filterType || "lowpass",
          this.sampleRate,
        );
      }
      if (effect.type === "delay") {
        return new DelayLine(this.sampleRate, 2);
      }
      if (effect.type === "compressor") {
        return new Compressor(this.sampleRate);
      }
      return null;
    });

    this.voices = patch.voices || [];
    this.voiceState.clear();
    this.activeNotes = [];

    this.voices.forEach((voice) => {
      const now =
        typeof globalThis.currentTime === "number" ? globalThis.currentTime : 0;
      this.voiceState.set(voice.id, {
        currentStep: 0,
        nextStepTime: now,
        pattern: voice.sequence?.pattern || [],
        rate: voice.sequence?.rate || 0,
      });
    });

    this.port.postMessage({
      type: "status",
      message: "patch-applied",
      counts: {
        oscillators: this.oscillators.length,
        noise: this.noise.length,
        modulators: this.modulators.length,
        effects: this.effects.length,
        voices: this.voices.length,
      },
    });
  }

  applyLimiter(l, r) {
    const peak = Math.max(Math.abs(l), Math.abs(r));
    if (peak > this.limiterThreshold) {
      const target = this.limiterThreshold / peak;
      this.limiterGain = Math.min(this.limiterGain, target);
    } else {
      this.limiterGain =
        this.limiterGain + (1 - this.limiterGain) * (1 - this.limiterRelease);
    }
    return [l * this.limiterGain, r * this.limiterGain];
  }

  renderOscSample(osc, freq, gain) {
    const phase = osc.phase;
    let sample = 0;
    switch (osc.type) {
      case "square":
        sample = phase < Math.PI ? 1 : -1;
        break;
      case "sawtooth":
        sample = 2 * (phase / (2 * Math.PI)) - 1;
        break;
      case "triangle":
        sample = 2 * Math.abs(2 * (phase / (2 * Math.PI)) - 1) - 1;
        break;
      case "sine":
      default:
        sample = Math.sin(phase);
        break;
    }

    const phaseInc = (2 * Math.PI * freq) / this.sampleRate;
    osc.phase = (phase + phaseInc) % (2 * Math.PI);
    return sample * gain;
  }

  renderNoiseSample() {
    return Math.random() * 2 - 1;
  }

  applyPan(sample, pan) {
    const clamped = Math.max(-1, Math.min(1, pan));
    const left = sample * Math.cos((clamped + 1) * 0.25 * Math.PI);
    const right = sample * Math.sin((clamped + 1) * 0.25 * Math.PI);
    return [left, right];
  }

  getModSum(targetId, param, modValues) {
    const key = `${targetId}:${param}`;
    const mods = this.routingMap.get(key);
    if (!mods) return 0;
    let sum = 0;
    for (const modId of mods) {
      sum += modValues[modId] || 0;
    }
    return sum;
  }

  computeModValues(time) {
    const modValues = {};
    for (const mod of this.modulators) {
      if (mod.type === "lfo") {
        const phaseInc = (2 * Math.PI * mod.rate) / this.sampleRate;
        mod.phase = (mod.phase + phaseInc) % (2 * Math.PI);
        const wave = mod.wave || "sine";
        let value = 0;
        if (wave === "square") value = mod.phase < Math.PI ? 1 : -1;
        else if (wave === "triangle")
          value = 2 * Math.abs(2 * (mod.phase / (2 * Math.PI)) - 1) - 1;
        else if (wave === "sawtooth")
          value = 2 * (mod.phase / (2 * Math.PI)) - 1;
        else value = Math.sin(mod.phase);
        modValues[mod.id] = value * mod.depth;
      } else if (mod.type === "sampleHold") {
        const interval = 1 / Math.max(0.01, mod.rate);
        if (time - mod.lastUpdate >= interval) {
          mod.value = Math.random() * (mod.max - mod.min) + mod.min;
          mod.lastUpdate = time;
        }
        modValues[mod.id] = mod.value;
      } else if (mod.type === "chaos") {
        const interval = 1 / Math.max(0.01, mod.rate);
        if (time - mod.lastUpdate >= interval) {
          const change = (Math.random() - 0.5) * 2 * mod.step * mod.range;
          mod.value = Math.max(
            mod.center - mod.range,
            Math.min(mod.center + mod.range, mod.value + change),
          );
          mod.lastUpdate = time;
        }
        modValues[mod.id] = mod.value;
      }
    }
    return modValues;
  }

  scheduleVoices(blockStart, blockEnd) {
    for (const voice of this.voices) {
      if (!voice.sequence?.pattern || !voice.sequence?.rate) continue;
      if (voice.sequence.pattern.length === 0) continue;
      const state = this.voiceState.get(voice.id);
      if (!state) continue;

      const stepDuration = 1 / voice.sequence.rate;
      while (state.nextStepTime <= blockEnd) {
        if (state.nextStepTime >= blockStart) {
          const stepIndex = state.currentStep % voice.sequence.pattern.length;
          if (voice.sequence.pattern[stepIndex] === 1) {
            const env = voice.envelope || {
              attack: 0.01,
              decay: 0.1,
              sustain: 0.1,
              release: 0.1,
            };
            const start = state.nextStepTime;
            const releaseStart = start + env.attack + env.decay + 0.01;
            const end = releaseStart + env.release + 0.05;
            this.activeNotes.push({
              voice,
              start,
              end,
              releaseStart,
              env,
              phase: 0,
              filterState: voice.filter
                ? new BiquadFilter(
                    voice.filter.type || "lowpass",
                    this.sampleRate,
                  )
                : null,
            });
          }
        }
        state.currentStep =
          (state.currentStep + 1) % voice.sequence.pattern.length;
        state.nextStepTime += stepDuration;
      }
    }
  }

  envelopeAt(note, time) {
    const t = time - note.start;
    if (t < 0) return 0;
    if (t < note.env.attack) return t / Math.max(0.0001, note.env.attack);
    if (t < note.env.attack + note.env.decay) {
      const d = (t - note.env.attack) / Math.max(0.0001, note.env.decay);
      return 1 + (note.env.sustain - 1) * d;
    }
    if (time < note.releaseStart) return note.env.sustain;
    const r = (time - note.releaseStart) / Math.max(0.0001, note.env.release);
    return Math.max(0, note.env.sustain * (1 - r));
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    const blockStart = currentTime;
    const blockEnd = currentTime + left.length / this.sampleRate;

    this.scheduleVoices(blockStart, blockEnd);

    for (let i = 0; i < left.length; i++) {
      const time = blockStart + i / this.sampleRate;
      const modValues = this.computeModValues(time);

      let l = 0;
      let r = 0;

      for (const osc of this.oscillators) {
        const freq = osc.freq + this.getModSum(osc.id, "frequency", modValues);
        const gain = osc.gain + this.getModSum(osc.id, "gain", modValues);
        const pan = osc.pan + this.getModSum(osc.id, "pan", modValues);
        const detune = osc.detune + this.getModSum(osc.id, "detune", modValues);
        const detunedFreq = freq * Math.pow(2, detune / 1200);
        const sample = this.renderOscSample(osc, detunedFreq, gain);
        const [pl, pr] = this.applyPan(sample, pan);
        l += pl;
        r += pr;
      }

      for (const n of this.noise) {
        const gain = n.gain + this.getModSum(n.id, "gain", modValues);
        const pan = n.pan + this.getModSum(n.id, "pan", modValues);
        const sample = this.renderNoiseSample() * gain;
        const [pl, pr] = this.applyPan(sample, pan);
        l += pl;
        r += pr;
      }

      // DEBUG: Log first sample if we have noise

      if (this.activeNotes.length > 0) {
        const stillActive = [];
        for (const note of this.activeNotes) {
          if (time > note.end) continue;
          const amp = this.envelopeAt(note, time);
          if (amp <= 0) {
            stillActive.push(note);
            continue;
          }
          let sample = 0;
          const source = note.voice.source || { type: "oscillator", freq: 220 };
          if (source.type === "noise") {
            sample = this.renderNoiseSample();
          } else {
            const freq = source.freq || 220;
            const type = source.wave || "sine";
            const phase = note.phase;
            switch (type) {
              case "square":
                sample = phase < Math.PI ? 1 : -1;
                break;
              case "sawtooth":
                sample = 2 * (phase / (2 * Math.PI)) - 1;
                break;
              case "triangle":
                sample = 2 * Math.abs(2 * (phase / (2 * Math.PI)) - 1) - 1;
                break;
              case "sine":
              default:
                sample = Math.sin(phase);
                break;
            }
            const phaseInc = (2 * Math.PI * freq) / this.sampleRate;
            note.phase = (phase + phaseInc) % (2 * Math.PI);
          }

          sample *= amp * (note.voice.gain ?? 1);

          if (note.filterState) {
            note.filterState.update(
              note.voice.filter.type || "lowpass",
              note.voice.filter.freq || 1000,
              note.voice.filter.q || 1,
            );
            sample = note.filterState.process(sample);
          }

          const [pl, pr] = this.applyPan(sample, note.voice.pan || 0);
          l += pl;
          r += pr;
          stillActive.push(note);
        }
        this.activeNotes = stillActive;
      }

      // Effects chain (global)
      for (let e = 0; e < this.effects.length; e++) {
        const effect = this.effects[e];
        const state = this.effectState[e];
        if (effect.type === "filter" && state) {
          const freq =
            (effect.freq || 1000) +
            this.getModSum(effect.id, "freq", modValues);
          const q = (effect.q || 1) + this.getModSum(effect.id, "q", modValues);
          state.update(effect.filterType || "lowpass", freq, q);
          l = state.process(l);
          r = state.process(r);
        } else if (effect.type === "delay" && state) {
          const timeVal =
            (effect.time || 0.25) +
            this.getModSum(effect.id, "time", modValues);
          const fb =
            (effect.feedback || 0.3) +
            this.getModSum(effect.id, "feedback", modValues);
          state.update(timeVal, fb);
          [l, r] = state.process(l, r);
        } else if (effect.type === "distortion") {
          const amount =
            (effect.amount || 0) +
            this.getModSum(effect.id, "amount", modValues);
          const k = Math.max(0, amount) / 50 + 1;
          l = Math.tanh(l * k);
          r = Math.tanh(r * k);
        } else if (effect.type === "compressor" && state) {
          const threshold = effect.threshold ?? -24;
          const ratio = effect.ratio ?? 4;
          const attack = effect.attack ?? 0.003;
          const release = effect.release ?? 0.25;
          const knee = effect.knee ?? 0;
          const makeup = effect.makeup ?? 0;
          state.update(threshold, ratio, attack, release, knee, makeup);
          l = state.process(l);
          r = state.process(r);
        }
      }

      left[i] = l;
      right[i] = r;
    }

    for (let i = 0; i < left.length; i++) {
      const [sl, sr] = this.applyLimiter(left[i], right[i]);
      left[i] = sl;
      right[i] = sr;
    }

    return true;
  }
}

registerProcessor("dsp-worklet", DSPWorkletProcessor);
