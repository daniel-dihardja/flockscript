/**
 * Performance Patches for Art Installations & Live Coding
 * Focused, high-contrast example set
 */

export const patches = {
  // === High-contrast set (fewer, clearer examples) ===

  "01 - Low / Sub Fog": {
    oscillators: [
      { id: "sub", freq: 40, gain: 0.28, type: "sine", pan: 0 },
      { id: "undertone", freq: 60, gain: 0.12, type: "triangle", pan: -0.2 },
    ],
    modulators: [
      { type: "lfo", id: "slowSwell", rate: 0.1, depth: 0.08, wave: "sine" },
    ],
    routing: [{ from: "slowSwell", to: "sub", param: "gain" }],
    effects: [{ type: "filter", filterType: "lowpass", freq: 180, q: 6 }],
  },

  "02 - High / Glass Air": {
    oscillators: [
      { id: "air1", freq: 1760, gain: 0.14, type: "sine", pan: -0.4 },
      { id: "air2", freq: 2200, gain: 0.14, type: "sine", pan: 0.4 },
      { id: "spark", freq: 1320, gain: 0.12, type: "triangle", pan: 0 },
    ],
    modulators: [
      { type: "lfo", id: "flutter", rate: 6, depth: 0.05, wave: "sine" },
    ],
    routing: [{ from: "flutter", to: "spark", param: "gain" }],
    effects: [
      { type: "filter", filterType: "highpass", freq: 900, q: 2 },
      { type: "delay", time: 0.25, feedback: 0.45 },
    ],
  },

  "03 - Dark / Murk": {
    noise: [{ id: "hiss", gain: 0.18, pan: 0 }],
    modulators: [
      { type: "lfo", id: "slowSweep", rate: 0.18, depth: 500, wave: "sine" },
    ],
    effects: [
      {
        type: "filter",
        id: "murkFilter",
        filterType: "bandpass",
        freq: 320,
        q: 14,
      },
      { type: "delay", time: 0.5, feedback: 0.6 },
    ],
    routing: [{ from: "slowSweep", to: "murkFilter", param: "freq" }],
  },

  "04 - Bright / Sparkle": {
    oscillators: [
      { id: "shine1", freq: 990, gain: 0.16, type: "square", pan: -0.6 },
      { id: "shine2", freq: 1180, gain: 0.16, type: "square", pan: 0.6 },
      { id: "tone", freq: 660, gain: 0.12, type: "triangle", pan: 0 },
    ],
    modulators: [
      { type: "sampleHold", id: "jump", rate: 8, min: 500, max: 2000 },
      { type: "lfo", id: "trem", rate: 7, depth: 0.1, wave: "square" },
    ],
    routing: [
      { from: "jump", to: "tone", param: "frequency" },
      { from: "trem", to: "shine1", param: "gain" },
    ],
    effects: [
      { type: "filter", filterType: "highpass", freq: 600, q: 3 },
      { type: "delay", time: 0.1875, feedback: 0.55 },
    ],
  },

  "05 - Complex / Clockwork": {
    tempo: 110,
    stepsPerBeat: 4,
    voices: [
      {
        id: "kick",
        source: { type: "oscillator", freq: 70, wave: "sine" },
        envelope: { attack: 0.002, decay: 0.08, sustain: 0.2, release: 0.03 },
        sequence: { pattern: [1, 0, 0, 1, 0, 0, 1, 0], rate: 8 },
        gain: 0.75,
        pan: 0,
      },
      {
        id: "hat",
        source: { type: "noise" },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
        sequence: { pattern: [0, 1, 0, 1, 0, 1, 0, 1], rate: 8 },
        gain: 0.35,
        pan: 0.3,
        filter: { type: "highpass", freq: 4200, q: 2 },
      },
      {
        id: "click",
        source: { type: "oscillator", freq: 520, wave: "triangle" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.02 },
        sequence: { pattern: [1, 0, 1, 0, 1, 0, 1, 0], rate: 8 },
        gain: 0.4,
        pan: -0.3,
      },
    ],
  },

  "06 - Noise Drone / Slow Mod": {
    noise: [
      { id: "drone", gain: 0.22, pan: 0 },
      { id: "air", gain: 0.12, pan: -0.3 },
    ],
    modulators: [
      { type: "lfo", id: "slowSweep", rate: 0.08, depth: 600, wave: "sine" },
      { type: "lfo", id: "slowPan", rate: 0.05, depth: 0.7, wave: "triangle" },
      {
        type: "chaos",
        id: "drift",
        rate: 0.12,
        center: 0,
        range: 25,
        step: 0.05,
      },
    ],
    effects: [
      {
        type: "filter",
        id: "droneFilter",
        filterType: "bandpass",
        freq: 300,
        q: 12,
      },
      { type: "delay", time: 0.6, feedback: 0.65 },
    ],
    routing: [
      { from: "slowSweep", to: "droneFilter", param: "freq" },
      { from: "drift", to: "droneFilter", param: "q" },
      { from: "slowPan", to: "air", param: "pan" },
    ],
  },

  "07 - Polyrhythm / Pulse + Sine Kick": {
    tempo: 120,
    stepsPerBeat: 4,
    voices: [
      {
        id: "sineKick",
        source: { type: "oscillator", freq: 55, wave: "sine" },
        envelope: { attack: 0.001, decay: 0.09, sustain: 0.2, release: 0.04 },
        sequence: { pattern: [1, 0, 0, 1, 0, 0, 1, 0], rate: 8 },
        gain: 0.85,
        pan: 0,
      },
      {
        id: "pulseLow",
        source: { type: "oscillator", freq: 110, wave: "square" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.02 },
        sequence: { pattern: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0], rate: 10 },
        gain: 0.45,
        pan: -0.3,
      },
      {
        id: "pulseHigh",
        source: { type: "oscillator", freq: 330, wave: "square" },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0.08, release: 0.02 },
        sequence: { pattern: [0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0], rate: 12 },
        gain: 0.35,
        pan: 0.3,
      },
      {
        id: "hat",
        source: { type: "noise" },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
        sequence: { pattern: [0, 1, 0, 1, 0, 1, 0, 1], rate: 8 },
        gain: 0.3,
        pan: 0.2,
        filter: { type: "highpass", freq: 5000, q: 2 },
      },
    ],
  },

  "08 - Silence": {
    oscillators: [],
    noise: [],
    modulators: [],
    routing: [],
    effects: [],
    voices: [],
  },
};

export const patchNames = Object.keys(patches);

/*
export const patches = {
  // === High-contrast set (fewer, clearer examples) ===

  "01 - Low / Sub Fog": {
    oscillators: [
      { id: "sub", freq: 40, gain: 0.28, type: "sine", pan: 0 },
      { id: "undertone", freq: 60, gain: 0.12, type: "triangle", pan: -0.2 },
    ],
    modulators: [
      { type: "lfo", id: "slowSwell", rate: 0.1, depth: 0.08, wave: "sine" },
    ],
    routing: [{ from: "slowSwell", to: "sub", param: "gain" }],
    effects: [{ type: "filter", filterType: "lowpass", freq: 180, q: 6 }],
  },

  "02 - High / Glass Air": {
    oscillators: [
      { id: "air1", freq: 1760, gain: 0.14, type: "sine", pan: -0.4 },
      { id: "air2", freq: 2200, gain: 0.14, type: "sine", pan: 0.4 },
      { id: "spark", freq: 1320, gain: 0.12, type: "triangle", pan: 0 },
    ],
    modulators: [
      { type: "lfo", id: "flutter", rate: 6, depth: 0.05, wave: "sine" },
    ],
    routing: [{ from: "flutter", to: "spark", param: "gain" }],
    effects: [
      { type: "filter", filterType: "highpass", freq: 900, q: 2 },
      { type: "delay", time: 0.25, feedback: 0.45 },
    ],
  },

  "03 - Dark / Murk": {
    noise: [{ id: "hiss", gain: 0.18, pan: 0 }],
    modulators: [
      { type: "lfo", id: "slowSweep", rate: 0.18, depth: 500, wave: "sine" },
    ],
    effects: [
      { type: "filter", id: "murkFilter", filterType: "bandpass", freq: 320, q: 14 },
      { type: "delay", time: 0.5, feedback: 0.6 },
    ],
    routing: [{ from: "slowSweep", to: "murkFilter", param: "freq" }],
  },

  "04 - Bright / Sparkle": {
    oscillators: [
      { id: "shine1", freq: 990, gain: 0.16, type: "square", pan: -0.6 },
      { id: "shine2", freq: 1180, gain: 0.16, type: "square", pan: 0.6 },
      { id: "tone", freq: 660, gain: 0.12, type: "triangle", pan: 0 },
    ],
    modulators: [
      { type: "sampleHold", id: "jump", rate: 8, min: 500, max: 2000 },
      { type: "lfo", id: "trem", rate: 7, depth: 0.1, wave: "square" },
    ],
    routing: [
      { from: "jump", to: "tone", param: "frequency" },
      { from: "trem", to: "shine1", param: "gain" },
    ],
    effects: [
      { type: "filter", filterType: "highpass", freq: 600, q: 3 },
      { type: "delay", time: 0.1875, feedback: 0.55 },
    ],
  },

  "05 - Complex / Clockwork": {
    tempo: 110,
    stepsPerBeat: 4,
    voices: [
      {
        id: "kick",
        source: { type: "oscillator", freq: 70, wave: "sine" },
        envelope: { attack: 0.002, decay: 0.08, sustain: 0.2, release: 0.03 },
        sequence: { pattern: [1, 0, 0, 1, 0, 0, 1, 0], rate: 8 },
        gain: 0.75,
        pan: 0,
      },
      {
        id: "hat",
        source: { type: "noise" },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
        sequence: { pattern: [0, 1, 0, 1, 0, 1, 0, 1], rate: 8 },
        gain: 0.35,
        pan: 0.3,
        filter: { type: "highpass", freq: 4200, q: 2 },
      },
      {
        id: "click",
        source: { type: "oscillator", freq: 520, wave: "triangle" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.02 },
        sequence: { pattern: [1, 0, 1, 0, 1, 0, 1, 0], rate: 8 },
        gain: 0.4,
        pan: -0.3,
      },
    ],
  },

  "06 - Silence": {
    oscillators: [],
    noise: [],
    modulators: [],
    routing: [],
    effects: [],
    voices: [],
    effects: [
};
      { type: "filter", filterType: "lowpass", freq: 900, q: 5 },
      { type: "delay", time: 0.375, feedback: 0.6 },
    ],
  },

  "30 - Density Morph": {
    oscillators: [
      { id: "sparse1", freq: 110, gain: 0.16, type: "triangle", pan: -0.7 },
      { id: "sparse2", freq: 220, gain: 0.14, type: "triangle", pan: 0.7 },
      { id: "dense1", freq: 330, gain: 0.12, type: "sawtooth", pan: -0.5 },
      { id: "dense2", freq: 440, gain: 0.12, type: "sawtooth", pan: 0.5 },
      { id: "dense3", freq: 660, gain: 0.1, type: "square", pan: -0.3 },
      { id: "dense4", freq: 880, gain: 0.1, type: "square", pan: 0.3 },
    ],
    modulators: [
      { type: "lfo", id: "sparse_gate1", rate: 2, depth: 0.16, wave: "square" },
      { type: "lfo", id: "sparse_gate2", rate: 3, depth: 0.14, wave: "square" },
      { type: "lfo", id: "density", rate: 0.15, depth: 0.12, wave: "triangle" },
      { type: "lfo", id: "complexity", rate: 0.12, depth: 0.1, wave: "sine" },
    ],
    routing: [
      { from: "sparse_gate1", to: "sparse1", param: "gain" },
      { from: "sparse_gate2", to: "sparse2", param: "gain" },
      { from: "density", to: "dense1", param: "gain" },
      { from: "density", to: "dense2", param: "gain" },
      { from: "complexity", to: "dense3", param: "gain" },
      { from: "complexity", to: "dense4", param: "gain" },
    ],
    effects: [
      { type: "filter", filterType: "bandpass", freq: 700, q: 6 },
      { type: "delay", time: 0.25, feedback: 0.55 },
      { type: "distortion", amount: 20 },
    ],
  },

  "31 - Conversation": {
    oscillators: [
      { id: "voice_a", freq: 220, gain: 0.18, type: "sawtooth", pan: -0.8 },
      { id: "voice_b", freq: 330, gain: 0.16, type: "sawtooth", pan: 0.8 },
      { id: "silence", freq: 440, gain: 0.08, type: "sine", pan: 0 },
    ],
    modulators: [
      { type: "lfo", id: "speak_a", rate: 0.4, depth: 0.18, wave: "triangle" },
      { type: "lfo", id: "speak_b", rate: 0.37, depth: 0.16, wave: "triangle" },
      { type: "lfo", id: "silence_fade", rate: 0.5, depth: 0.08, wave: "sine" },
      { type: "sampleHold", id: "interruption", rate: 1.5, min: 180, max: 400 },
    ],
    routing: [
      { from: "speak_a", to: "voice_a", param: "gain" },
      { from: "speak_b", to: "voice_b", param: "gain" },
      { from: "silence_fade", to: "silence", param: "gain" },
      { from: "interruption", to: "voice_a", param: "frequency" },
    ],
    effects: [
      { type: "filter", filterType: "lowpass", freq: 800, q: 4 },
      { type: "delay", time: 0.4, feedback: 0.5 },
    ],
  },

  "32 - Accumulation": {
    oscillators: [
      { id: "drop1", freq: 880, gain: 0.1, type: "sine", pan: -0.9 },
      { id: "drop2", freq: 660, gain: 0.11, type: "sine", pan: -0.6 },
      { id: "drop3", freq: 440, gain: 0.12, type: "sine", pan: -0.3 },
      { id: "drop4", freq: 330, gain: 0.14, type: "triangle", pan: 0 },
      { id: "drop5", freq: 220, gain: 0.16, type: "triangle", pan: 0.3 },
      { id: "pool", freq: 110, gain: 0.2, type: "sawtooth", pan: 0 },
    ],
    modulators: [
      { type: "lfo", id: "drip1", rate: 3, depth: 0.1, wave: "square" },
      { type: "lfo", id: "drip2", rate: 5, depth: 0.11, wave: "square" },
      { type: "lfo", id: "drip3", rate: 7, depth: 0.12, wave: "square" },
      { type: "lfo", id: "build", rate: 0.1, depth: 0.2, wave: "triangle" },
      { type: "chaos", id: "splash", rate: 4, center: 0, range: 40, step: 0.3 },
    ],
    routing: [
      { from: "drip1", to: "drop1", param: "gain" },
      { from: "drip2", to: "drop2", param: "gain" },
      { from: "drip3", to: "drop3", param: "gain" },
      { from: "build", to: "pool", param: "gain" },
      { from: "splash", to: "drop4", param: "detune" },
    ],
    effects: [
      { type: "delay", time: 0.5, feedback: 0.7 },
      { type: "filter", filterType: "lowpass", freq: 1000, q: 5 },
    ],
  },

  "33 - Storm Cycle": {
    oscillators: [
      { id: "rumble", freq: 55, gain: 0.22, type: "sine", pan: 0 },
      { id: "wind1", freq: 1200, gain: 0.08, type: "sawtooth", pan: -0.6 },
      { id: "wind2", freq: 1400, gain: 0.08, type: "sawtooth", pan: 0.6 },
    ],
    noise: [
      { id: "rain", gain: 0.15, pan: -0.3 },
      { id: "static", gain: 0.1, pan: 0.3 },
    ],
    modulators: [
      {
        type: "lfo",
        id: "storm_intensity",
        rate: 0.05,
        depth: 0.18,
        wave: "sine",
      },
      {
        type: "lfo",
        id: "wind_gust",
        rate: 0.3,
        depth: 0.08,
        wave: "triangle",
      },
      {
        type: "chaos",
        id: "lightning",
        rate: 1,
        center: 0,
        range: 100,
        step: 0.5,
      },
      { type: "lfo", id: "calm", rate: 0.08, depth: 0.2, wave: "sine" },
    ],
    routing: [
      { from: "storm_intensity", to: "rain", param: "gain" },
      { from: "storm_intensity", to: "static", param: "gain" },
      { from: "wind_gust", to: "wind1", param: "gain" },
      { from: "wind_gust", to: "wind2", param: "gain" },
      { from: "lightning", to: "rumble", param: "detune" },
    ],
    effects: [
      { type: "filter", id: "filt", filterType: "bandpass", freq: 600, q: 4 },
      { type: "delay", time: 0.666, feedback: 0.68 },
      { type: "distortion", amount: 30 },
    ],
  },

  "34 - Whisper to Scream": {
    oscillators: [
      { id: "whisper1", freq: 440, gain: 0.08, type: "sine", pan: -0.5 },
      { id: "whisper2", freq: 660, gain: 0.08, type: "sine", pan: 0.5 },
      { id: "build1", freq: 220, gain: 0.14, type: "sawtooth", pan: -0.3 },
      { id: "build2", freq: 330, gain: 0.14, type: "sawtooth", pan: 0.3 },
      { id: "scream", freq: 1760, gain: 0.12, type: "square", pan: 0 },
    ],
    modulators: [
      { type: "lfo", id: "whisper_fade", rate: 0.2, depth: 0.08, wave: "sine" },
      { type: "lfo", id: "tension", rate: 0.15, depth: 0.14, wave: "triangle" },
      { type: "lfo", id: "release", rate: 0.1, depth: 0.12, wave: "sine" },
      { type: "sampleHold", id: "intensity", rate: 1, min: 0, max: 0.2 },
    ],
    routing: [
      { from: "whisper_fade", to: "whisper1", param: "gain" },
      { from: "whisper_fade", to: "whisper2", param: "gain" },
      { from: "tension", to: "build1", param: "gain" },
      { from: "tension", to: "build2", param: "gain" },
      { from: "release", to: "scream", param: "gain" },
    ],
    effects: [
      { type: "filter", filterType: "lowpass", freq: 1200, q: 8 },
      { type: "distortion", amount: 40 },
      { type: "delay", time: 0.25, feedback: 0.65 },
    ],
  },

  "35 - Lunar Phases": {
    oscillators: [
      { id: "new_moon", freq: 55, gain: 0.05, type: "sine", pan: 0 },
      { id: "crescent", freq: 110, gain: 0.1, type: "triangle", pan: -0.5 },
      { id: "quarter", freq: 165, gain: 0.15, type: "triangle", pan: 0.5 },
      { id: "gibbous", freq: 220, gain: 0.18, type: "sawtooth", pan: -0.3 },
      { id: "full_moon", freq: 330, gain: 0.2, type: "sawtooth", pan: 0.3 },
    ],
    modulators: [
      { type: "lfo", id: "phase1", rate: 0.033, depth: 0.05, wave: "sine" },
      { type: "lfo", id: "phase2", rate: 0.033, depth: 0.1, wave: "sine" },
      { type: "lfo", id: "phase3", rate: 0.033, depth: 0.15, wave: "sine" },
      { type: "lfo", id: "phase4", rate: 0.033, depth: 0.18, wave: "sine" },
      { type: "lfo", id: "phase5", rate: 0.033, depth: 0.2, wave: "sine" },
    ],
    routing: [
      { from: "phase1", to: "new_moon", param: "gain" },
      { from: "phase2", to: "crescent", param: "gain" },
      { from: "phase3", to: "quarter", param: "gain" },
      { from: "phase4", to: "gibbous", param: "gain" },
      { from: "phase5", to: "full_moon", param: "gain" },
    ],
    effects: [
      { type: "delay", time: 0.909, feedback: 0.7 },
      { type: "filter", filterType: "lowpass", freq: 900, q: 6 },
    ],
  },

  // === RICH POLYRHYTHMIC ENSEMBLES (Complex short patterns) ===

  "36 - Triplet Nexus": {
    oscillators: [
      { id: "voice1", freq: 220, gain: 0.15, type: "square", pan: -0.7 },
      { id: "voice2", freq: 330, gain: 0.13, type: "square", pan: 0 },
      { id: "voice3", freq: 440, gain: 0.12, type: "square", pan: 0.7 },
      { id: "voice4", freq: 165, gain: 0.14, type: "sawtooth", pan: -0.3 },
      { id: "voice5", freq: 247.5, gain: 0.11, type: "sawtooth", pan: 0.3 },
    ],
    modulators: [
      { type: "lfo", id: "gate1", rate: 3, depth: 0.15, wave: "square" },
      { type: "lfo", id: "gate2", rate: 4, depth: 0.13, wave: "square" },
      { type: "lfo", id: "gate3", rate: 5, depth: 0.12, wave: "square" },
      { type: "lfo", id: "gate4", rate: 7, depth: 0.14, wave: "square" },
      { type: "lfo", id: "gate5", rate: 9, depth: 0.11, wave: "square" },
    ],
    routing: [
      { from: "gate1", to: "voice1", param: "gain" },
      { from: "gate2", to: "voice2", param: "gain" },
      { from: "gate3", to: "voice3", param: "gain" },
      { from: "gate4", to: "voice4", param: "gain" },
      { from: "gate5", to: "voice5", param: "gain" },
    ],
    effects: [
      { type: "filter", filterType: "bandpass", freq: 500, q: 8 },
      { type: "delay", time: 0.1, feedback: 0.4 },
    ],
  },

  "37 - Prime Dance": {
    oscillators: [
      { id: "p2", freq: 293.66, gain: 0.16, type: "triangle", pan: -0.8 },
      { id: "p3", freq: 329.63, gain: 0.15, type: "triangle", pan: -0.4 },
      { id: "p5", freq: 369.99, gain: 0.14, type: "triangle", pan: 0 },
      { id: "p7", freq: 415.3, gain: 0.13, type: "triangle", pan: 0.4 },
      { id: "p11", freq: 466.16, gain: 0.12, type: "triangle", pan: 0.8 },
    ],
    modulators: [
      { type: "lfo", id: "pulse2", rate: 2, depth: 0.16, wave: "square" },
      { type: "lfo", id: "pulse3", rate: 3, depth: 0.15, wave: "square" },
      { type: "lfo", id: "pulse5", rate: 5, depth: 0.14, wave: "square" },
      { type: "lfo", id: "pulse7", rate: 7, depth: 0.13, wave: "square" },
      { type: "lfo", id: "pulse11", rate: 11, depth: 0.12, wave: "square" },
      { type: "lfo", id: "sweep", rate: 0.3, depth: 400, wave: "sine" },
    ],
    routing: [
      { from: "pulse2", to: "p2", param: "gain" },
      { from: "pulse3", to: "p3", param: "gain" },
      { from: "pulse5", to: "p5", param: "gain" },
      { from: "pulse7", to: "p7", param: "gain" },
      { from: "pulse11", to: "p11", param: "gain" },
      { from: "sweep", to: "p2", param: "frequency" },
      { from: "sweep", to: "p3", param: "frequency" },
    ],
    effects: [
      { type: "filter", filterType: "highpass", freq: 200, q: 4 },
      { type: "delay", time: 0.187, feedback: 0.5 },
      { type: "distortion", amount: 15 },
    ],
  },

  "38 - Hemiola Cascade": {
    oscillators: [
      { id: "bass", freq: 110, gain: 0.2, type: "sawtooth", pan: 0 },
      { id: "mid1", freq: 220, gain: 0.14, type: "square", pan: -0.5 },
      { id: "mid2", freq: 330, gain: 0.12, type: "square", pan: 0.5 },
      { id: "high1", freq: 440, gain: 0.1, type: "triangle", pan: -0.7 },
      { id: "high2", freq: 660, gain: 0.08, type: "triangle", pan: 0.7 },
    ],
    modulators: [
      { type: "lfo", id: "bassgate", rate: 2, depth: 0.2, wave: "square" },
      { type: "lfo", id: "midgate1", rate: 3, depth: 0.14, wave: "square" },
      { type: "lfo", id: "midgate2", rate: 6, depth: 0.12, wave: "square" },
      { type: "lfo", id: "highgate1", rate: 9, depth: 0.1, wave: "square" },
      { type: "lfo", id: "highgate2", rate: 4.5, depth: 0.08, wave: "square" },
      { type: "lfo", id: "detune", rate: 0.4, depth: 8, wave: "sine" },
    ],
    routing: [
      { from: "bassgate", to: "bass", param: "gain" },
      { from: "midgate1", to: "mid1", param: "gain" },
      { from: "midgate2", to: "mid2", param: "gain" },
      { from: "highgate1", to: "high1", param: "gain" },
      { from: "highgate2", to: "high2", param: "gain" },
      { from: "detune", to: "mid1", param: "detune" },
      { from: "detune", to: "mid2", param: "detune" },
    ],
    effects: [
      { type: "filter", filterType: "lowpass", freq: 1200, q: 5 },
      { type: "delay", time: 0.125, feedback: 0.45 },
    ],
  },

  "39 - Syncopated Web": {
    oscillators: [
      { id: "kick", freq: 55, gain: 0.22, type: "sine", pan: 0 },
      { id: "snare1", freq: 200, gain: 0.15, type: "square", pan: -0.6 },
      { id: "snare2", freq: 280, gain: 0.14, type: "square", pan: 0.6 },
      { id: "hat1", freq: 880, gain: 0.09, type: "triangle", pan: -0.8 },
      { id: "hat2", freq: 1320, gain: 0.08, type: "triangle", pan: 0.8 },
      { id: "perc", freq: 550, gain: 0.1, type: "sawtooth", pan: 0.3 },
    ],
    noise: [{ id: "hiss", gain: 0.06, pan: 0 }],
    modulators: [
      { type: "lfo", id: "k_gate", rate: 4, depth: 0.22, wave: "square" },
      { type: "lfo", id: "s1_gate", rate: 2.67, depth: 0.15, wave: "square" },
      { type: "lfo", id: "s2_gate", rate: 5.33, depth: 0.14, wave: "square" },
      { type: "lfo", id: "h1_gate", rate: 8, depth: 0.09, wave: "square" },
      { type: "lfo", id: "h2_gate", rate: 12, depth: 0.08, wave: "square" },
      { type: "lfo", id: "p_gate", rate: 7, depth: 0.1, wave: "square" },
      { type: "lfo", id: "hiss_gate", rate: 16, depth: 0.06, wave: "square" },
    ],
    routing: [
      { from: "k_gate", to: "kick", param: "gain" },
      { from: "s1_gate", to: "snare1", param: "gain" },
      { from: "s2_gate", to: "snare2", param: "gain" },
      { from: "h1_gate", to: "hat1", param: "gain" },
      { from: "h2_gate", to: "hat2", param: "gain" },
      { from: "p_gate", to: "perc", param: "gain" },
      { from: "hiss_gate", to: "hiss", param: "gain" },
    ],
    effects: [
      { type: "filter", filterType: "highpass", freq: 40, q: 2 },
      { type: "delay", time: 0.0625, feedback: 0.35 },
      { type: "distortion", amount: 20 },
    ],
  },

  "40 - Metric Modulation": {
    oscillators: [
      { id: "ref", freq: 165, gain: 0.18, type: "sawtooth", pan: 0 },
      { id: "v2", freq: 220, gain: 0.15, type: "square", pan: -0.4 },
      { id: "v3", freq: 247.5, gain: 0.14, type: "square", pan: 0.4 },
      { id: "v4", freq: 330, gain: 0.12, type: "triangle", pan: -0.7 },
      { id: "v5", freq: 412.5, gain: 0.1, type: "triangle", pan: 0.7 },
    ],
    modulators: [
      { type: "lfo", id: "g_ref", rate: 3, depth: 0.18, wave: "square" },
      { type: "lfo", id: "g2", rate: 4, depth: 0.15, wave: "square" },
      { type: "lfo", id: "g3", rate: 4.5, depth: 0.14, wave: "square" },
      { type: "lfo", id: "g4", rate: 6, depth: 0.12, wave: "square" },
      { type: "lfo", id: "g5", rate: 7.5, depth: 0.1, wave: "square" },
      { type: "lfo", id: "mod_speed", rate: 0.2, depth: 1, wave: "triangle" },
    ],
    routing: [
      { from: "g_ref", to: "ref", param: "gain" },
      { from: "g2", to: "v2", param: "gain" },
      { from: "g3", to: "v3", param: "gain" },
      { from: "g4", to: "v4", param: "gain" },
      { from: "g5", to: "v5", param: "gain" },
      { from: "mod_speed", to: "g2", param: "rate" },
      { from: "mod_speed", to: "g3", param: "rate" },
      { from: "mod_speed", to: "g4", param: "rate" },
    ],
    effects: [
      { type: "filter", filterType: "bandpass", freq: 600, q: 7 },
      { type: "delay", time: 0.167, feedback: 0.5 },
    ],
  },

  "41 - Afro-Cuban Matrix": {
    oscillators: [
      { id: "clave", freq: 880, gain: 0.15, type: "square", pan: 0 },
      { id: "tumbao", freq: 110, gain: 0.18, type: "sawtooth", pan: -0.5 },
      { id: "cascara", freq: 660, gain: 0.12, type: "triangle", pan: 0.6 },
      { id: "montuno", freq: 440, gain: 0.13, type: "square", pan: -0.3 },
      { id: "bell", freq: 1320, gain: 0.1, type: "triangle", pan: 0.8 },
    ],
    noise: [{ id: "shaker", gain: 0.07, pan: -0.7 }],
    modulators: [
      {
        type: "lfo",
        id: "clave_pat",
        rate: 2.4,
        depth: 0.15,
        wave: "square",
      },
      {
        type: "lfo",
        id: "tumbao_pat",
        rate: 1.6,
        depth: 0.18,
        wave: "square",
      },
      {
        type: "lfo",
        id: "cascara_pat",
        rate: 4.8,
        depth: 0.12,
        wave: "square",
      },
      {
        type: "lfo",
        id: "montuno_pat",
        rate: 6.4,
        depth: 0.13,
        wave: "square",
      },
      { type: "lfo", id: "bell_pat", rate: 9.6, depth: 0.1, wave: "square" },
      {
        type: "lfo",
        id: "shaker_pat",
        rate: 19.2,
        depth: 0.07,
        wave: "square",
      },
    ],
    routing: [
      { from: "clave_pat", to: "clave", param: "gain" },
      { from: "tumbao_pat", to: "tumbao", param: "gain" },
      { from: "cascara_pat", to: "cascara", param: "gain" },
      { from: "montuno_pat", to: "montuno", param: "gain" },
      { from: "bell_pat", to: "bell", param: "gain" },
      { from: "shaker_pat", to: "shaker", param: "gain" },
    ],
    effects: [
      { type: "filter", filterType: "highpass", freq: 80, q: 3 },
      { type: "delay", time: 0.208, feedback: 0.4 },
      { type: "distortion", amount: 18 },
    ],
  },

  "42 - Interlocking Gates": {
    oscillators: [
      { id: "o1", freq: 220, gain: 0.16, type: "square", pan: -0.9 },
      { id: "o2", freq: 275, gain: 0.15, type: "square", pan: -0.6 },
      { id: "o3", freq: 330, gain: 0.14, type: "square", pan: -0.3 },
      { id: "o4", freq: 385, gain: 0.13, type: "square", pan: 0 },
      { id: "o5", freq: 440, gain: 0.12, type: "square", pan: 0.3 },
      { id: "o6", freq: 495, gain: 0.11, type: "square", pan: 0.6 },
      { id: "o7", freq: 550, gain: 0.1, type: "square", pan: 0.9 },
    ],
    modulators: [
      { type: "lfo", id: "g1", rate: 7, depth: 0.16, wave: "square" },
      { type: "lfo", id: "g2", rate: 6, depth: 0.15, wave: "square" },
      { type: "lfo", id: "g3", rate: 5, depth: 0.14, wave: "square" },
      { type: "lfo", id: "g4", rate: 4, depth: 0.13, wave: "square" },
      { type: "lfo", id: "g5", rate: 3, depth: 0.12, wave: "square" },
      { type: "lfo", id: "g6", rate: 2, depth: 0.11, wave: "square" },
      { type: "lfo", id: "g7", rate: 1.5, depth: 0.1, wave: "square" },
    ],
    routing: [
      { from: "g1", to: "o1", param: "gain" },
      { from: "g2", to: "o2", param: "gain" },
      { from: "g3", to: "o3", param: "gain" },
      { from: "g4", to: "o4", param: "gain" },
      { from: "g5", to: "o5", param: "gain" },
      { from: "g6", to: "o6", param: "gain" },
      { from: "g7", to: "o7", param: "gain" },
    ],
    effects: [
      { type: "filter", filterType: "bandpass", freq: 800, q: 9 },
      { type: "delay", time: 0.071, feedback: 0.5 },
    ],
  },

  "43 - Phase Drift": {
    oscillators: [
      { id: "anchor", freq: 110, gain: 0.2, type: "sawtooth", pan: 0 },
      { id: "drift1", freq: 220, gain: 0.15, type: "square", pan: -0.5 },
      { id: "drift2", freq: 330, gain: 0.14, type: "square", pan: 0.5 },
      { id: "drift3", freq: 440, gain: 0.12, type: "triangle", pan: -0.7 },
      { id: "drift4", freq: 550, gain: 0.1, type: "triangle", pan: 0.7 },
    ],
    modulators: [
      {
        type: "lfo",
        id: "anchor_gate",
        rate: 4,
        depth: 0.2,
        wave: "square",
      },
      {
        type: "lfo",
        id: "drift1_gate",
        rate: 4.05,
        depth: 0.15,
        wave: "square",
      },
      {
        type: "lfo",
        id: "drift2_gate",
        rate: 4.1,
        depth: 0.14,
        wave: "square",
      },
      {
        type: "lfo",
        id: "drift3_gate",
        rate: 4.15,
        depth: 0.12,
        wave: "square",
      },
      {
        type: "lfo",
        id: "drift4_gate",
        rate: 4.2,
        depth: 0.1,
        wave: "square",
      },
      { type: "lfo", id: "phase_mod", rate: 0.1, depth: 0.15, wave: "sine" },
    ],
    routing: [
      { from: "anchor_gate", to: "anchor", param: "gain" },
      { from: "drift1_gate", to: "drift1", param: "gain" },
      { from: "drift2_gate", to: "drift2", param: "gain" },
      { from: "drift3_gate", to: "drift3", param: "gain" },
      { from: "drift4_gate", to: "drift4", param: "gain" },
      { from: "phase_mod", to: "drift1_gate", param: "rate" },
      { from: "phase_mod", to: "drift2_gate", param: "rate" },
    ],
    effects: [
      { type: "filter", filterType: "lowpass", freq: 900, q: 6 },
      { type: "delay", time: 0.25, feedback: 0.6 },
    ],
  },

  "44 - Euclidean Ensemble": {
    oscillators: [
      { id: "e_5_8", freq: 165, gain: 0.16, type: "square", pan: -0.7 },
      { id: "e_7_12", freq: 220, gain: 0.15, type: "square", pan: -0.3 },
      { id: "e_9_16", freq: 275, gain: 0.14, type: "square", pan: 0.1 },
      { id: "e_11_16", freq: 330, gain: 0.13, type: "triangle", pan: 0.5 },
      { id: "e_13_24", freq: 385, gain: 0.12, type: "triangle", pan: 0.8 },
    ],
    modulators: [
      { type: "lfo", id: "euc1", rate: 5, depth: 0.16, wave: "square" },
      { type: "lfo", id: "euc2", rate: 7, depth: 0.15, wave: "square" },
      { type: "lfo", id: "euc3", rate: 9, depth: 0.14, wave: "square" },
      { type: "lfo", id: "euc4", rate: 11, depth: 0.13, wave: "square" },
      { type: "lfo", id: "euc5", rate: 13, depth: 0.12, wave: "square" },
      { type: "lfo", id: "drift", rate: 0.15, depth: 10, wave: "sine" },
    ],
    routing: [
      { from: "euc1", to: "e_5_8", param: "gain" },
      { from: "euc2", to: "e_7_12", param: "gain" },
      { from: "euc3", to: "e_9_16", param: "gain" },
      { from: "euc4", to: "e_11_16", param: "gain" },
      { from: "euc5", to: "e_13_24", param: "gain" },
      { from: "drift", to: "e_5_8", param: "detune" },
      { from: "drift", to: "e_7_12", param: "detune" },
      { from: "drift", to: "e_9_16", param: "detune" },
    ],
    effects: [
      { type: "filter", filterType: "bandpass", freq: 550, q: 8 },
      { type: "delay", time: 0.083, feedback: 0.45 },
      { type: "distortion", amount: 12 },
    ],
  },

  "45 - Polymetric Lattice": {
    oscillators: [
      { id: "layer1", freq: 110, gain: 0.17, type: "sawtooth", pan: -0.8 },
      { id: "layer2", freq: 146.67, gain: 0.16, type: "square", pan: -0.4 },
      { id: "layer3", freq: 183.33, gain: 0.15, type: "square", pan: 0 },
      { id: "layer4", freq: 220, gain: 0.14, type: "triangle", pan: 0.4 },
      { id: "layer5", freq: 293.33, gain: 0.12, type: "triangle", pan: 0.8 },
      { id: "accent", freq: 440, gain: 0.1, type: "sine", pan: 0 },
    ],
    modulators: [
      { type: "lfo", id: "g1", rate: 2, depth: 0.17, wave: "square" },
      { type: "lfo", id: "g2", rate: 3, depth: 0.16, wave: "square" },
      { type: "lfo", id: "g3", rate: 4, depth: 0.15, wave: "square" },
      { type: "lfo", id: "g4", rate: 5, depth: 0.14, wave: "square" },
      { type: "lfo", id: "g5", rate: 7, depth: 0.12, wave: "square" },
      { type: "lfo", id: "accent_g", rate: 13, depth: 0.1, wave: "square" },
      { type: "lfo", id: "texture", rate: 0.25, depth: 0.1, wave: "sine" },
    ],
    routing: [
      { from: "g1", to: "layer1", param: "gain" },
      { from: "g2", to: "layer2", param: "gain" },
      { from: "g3", to: "layer3", param: "gain" },
      { from: "g4", to: "layer4", param: "gain" },
      { from: "g5", to: "layer5", param: "gain" },
      { from: "accent_g", to: "accent", param: "gain" },
      { from: "texture", to: "layer2", param: "detune" },
      { from: "texture", to: "layer3", param: "detune" },
      { from: "texture", to: "layer4", param: "detune" },
    ],
    effects: [
      { type: "filter", filterType: "lowpass", freq: 1000, q: 5 },
      { type: "delay", time: 0.15, feedback: 0.5 },
    ],
  },

  "46 - Minimal Pulses": {
    oscillators: [
      // Three voices in polyrhythmic relationship (3:4:5)
      { id: "pulse1", freq: 220, gain: 0.15, type: "sine", pan: -0.6 },
      { id: "pulse2", freq: 440, gain: 0.12, type: "sine", pan: 0.6 },
      { id: "pulse3", freq: 165, gain: 0.18, type: "triangle", pan: 0 },
    ],
    noise: [],
    modulators: [
      // Polyrhythmic gates - 3:4:5 ratio (1.5 Hz base)
      { type: "lfo", id: "gate1", rate: 1.5, depth: 0.15, wave: "square" }, // 3 beats
      { type: "lfo", id: "gate2", rate: 2.0, depth: 0.12, wave: "square" }, // 4 beats
      { type: "lfo", id: "gate3", rate: 2.5, depth: 0.18, wave: "square" }, // 5 beats

      // Subtle pitch drift for organic feel
      { type: "lfo", id: "drift1", rate: 0.08, depth: 3, wave: "sine" },
      { type: "lfo", id: "drift2", rate: 0.11, depth: 4, wave: "sine" },

      // Stereo movement - very slow
      { type: "lfo", id: "pan_mod", rate: 0.05, depth: 0.3, wave: "sine" },
    ],
    routing: [
      // Apply polyrhythmic gates to voices
      { from: "gate1", to: "pulse1", param: "gain" },
      { from: "gate2", to: "pulse2", param: "gain" },
      { from: "gate3", to: "pulse3", param: "gain" },

      // Subtle pitch drift
      { from: "drift1", to: "pulse1", param: "frequency" },
      { from: "drift2", to: "pulse2", param: "frequency" },

      // Stereo drift on highest voice
      { from: "pan_mod", to: "pulse2", param: "pan" },
    ],
    effects: [
      // Clean lowpass to round off edges
      { type: "filter", filterType: "lowpass", freq: 3000, q: 1 },

      // Subtle delay for depth
      { type: "delay", time: 0.375, feedback: 0.25 },

      // Spacious reverb
    ],
  },

  "47 - Low/High Contrast": {
    oscillators: [
      // Deep sub bass foundation
      { id: "sub", freq: 55, gain: 0.25, type: "sine", pan: 0 },
      { id: "bass", freq: 110, gain: 0.2, type: "triangle", pan: 0 },

      // Bright high harmonics
      { id: "high1", freq: 3520, gain: 0.1, type: "sine", pan: -0.7 },
      { id: "high2", freq: 4400, gain: 0.08, type: "sine", pan: 0.7 },
      { id: "high3", freq: 5280, gain: 0.06, type: "sine", pan: 0 },
    ],
    noise: [
      // High frequency texture
      { id: "shimmer", gain: 0.08, pan: 0 },
    ],
    modulators: [
      // Bass pulse - slow and deep
      { type: "lfo", id: "bass_pulse", rate: 0.4, depth: 0.15, wave: "sine" },

      // High sparkle - fast shimmer
      { type: "lfo", id: "sparkle1", rate: 7.5, depth: 0.08, wave: "sine" },
      { type: "lfo", id: "sparkle2", rate: 9.2, depth: 0.06, wave: "sine" },
      { type: "lfo", id: "sparkle3", rate: 11.3, depth: 0.05, wave: "sine" },

      // Bass frequency drift
      { type: "lfo", id: "bass_drift", rate: 0.08, depth: 8, wave: "sine" },

      // Noise filter sweep
      {
        type: "lfo",
        id: "filter_sweep",
        rate: 0.25,
        depth: 2000,
        wave: "sine",
      },

      // Stereo width modulation
      { type: "lfo", id: "stereo_mod", rate: 0.15, depth: 0.5, wave: "sine" },
    ],
    routing: [
      // Modulate bass with slow pulse
      { from: "bass_pulse", to: "sub", param: "gain" },
      { from: "bass_pulse", to: "bass", param: "gain" },

      // Fast shimmer on high frequencies
      { from: "sparkle1", to: "high1", param: "gain" },
      { from: "sparkle2", to: "high2", param: "gain" },
      { from: "sparkle3", to: "high3", param: "gain" },

      // Bass drift
      { from: "bass_drift", to: "sub", param: "frequency" },

      // Stereo movement on highs
      { from: "stereo_mod", to: "high1", param: "pan" },
      { from: "stereo_mod", to: "high2", param: "pan" },
    ],
    effects: [
      // Highpass to isolate shimmer texture
      { type: "filter", filterType: "highpass", freq: 4000, q: 2 },

      // Delay for high frequency reflections
      { type: "delay", time: 0.25, feedback: 0.3 },

      // Expansive reverb
    ],
  },

  "48 - Low/High Contrast B": {
    oscillators: [
      // Pulsing sub bass
      { id: "sub", freq: 55, gain: 0.22, type: "sine", pan: 0 },
      { id: "bass", freq: 82.5, gain: 0.18, type: "sine", pan: 0 },

      // High metallic tones
      { id: "high1", freq: 2640, gain: 0.12, type: "triangle", pan: -0.8 },
      { id: "high2", freq: 3960, gain: 0.1, type: "triangle", pan: 0.8 },
      { id: "high3", freq: 5280, gain: 0.08, type: "sine", pan: 0 },
    ],
    noise: [
      // Filtered noise burst
      { id: "burst", gain: 0.1, pan: 0 },
    ],
    modulators: [
      // Fast bass rhythm - polyrhythmic
      { type: "lfo", id: "bass_gate1", rate: 2.3, depth: 0.2, wave: "square" },
      { type: "lfo", id: "bass_gate2", rate: 3.1, depth: 0.15, wave: "square" },

      // High frequency tremolo - slower than part A
      { type: "lfo", id: "high_trem", rate: 3.5, depth: 0.1, wave: "sine" },

      // Noise bursts
      { type: "lfo", id: "burst_gate", rate: 1.7, depth: 0.1, wave: "square" },

      // Pitch modulation for metallic quality
      { type: "lfo", id: "pitch_mod", rate: 5.2, depth: 15, wave: "sine" },

      // Pan sweep - wider movement
      { type: "lfo", id: "pan_sweep", rate: 0.18, depth: 0.7, wave: "sine" },

      // Bass frequency shift
      { type: "lfo", id: "bass_shift", rate: 0.12, depth: 6, wave: "triangle" },
    ],
    routing: [
      // Polyrhythmic bass gates
      { from: "bass_gate1", to: "sub", param: "gain" },
      { from: "bass_gate2", to: "bass", param: "gain" },

      // Tremolo on all highs
      { from: "high_trem", to: "high1", param: "gain" },
      { from: "high_trem", to: "high2", param: "gain" },
      { from: "high_trem", to: "high3", param: "gain" },

      // Metallic pitch vibrato on highs
      { from: "pitch_mod", to: "high1", param: "frequency" },
      { from: "pitch_mod", to: "high2", param: "frequency" },

      // Noise bursts
      { from: "burst_gate", to: "burst", param: "gain" },

      // Wide pan sweep
      { from: "pan_sweep", to: "high1", param: "pan" },
      { from: "pan_sweep", to: "high2", param: "pan" },

      // Bass shift
      { from: "bass_shift", to: "sub", param: "frequency" },
    ],
    effects: [
      // Bandpass for focused burst
      { type: "filter", filterType: "bandpass", freq: 3500, q: 3 },

      // Shorter delay with more feedback
      { type: "delay", time: 0.125, feedback: 0.45 },

      // Metallic reverb
    ],
  },

  "49 - Low/High Contrast C (Break)": {
    oscillators: [
      // Sparse bass - single tone
      { id: "sub", freq: 55, gain: 0.18, type: "sine", pan: 0 },

      // Single high tone - lonely
      { id: "high", freq: 4400, gain: 0.08, type: "sine", pan: 0 },
    ],
    noise: [],
    modulators: [
      // Very slow bass pulse - breathing
      { type: "lfo", id: "bass_breath", rate: 0.25, depth: 0.12, wave: "sine" },

      // High tone fades in/out slowly
      { type: "lfo", id: "high_fade", rate: 0.18, depth: 0.06, wave: "sine" },

      // Gentle bass drift
      { type: "lfo", id: "bass_drift", rate: 0.06, depth: 5, wave: "sine" },

      // High pitch wobble - very subtle
      { type: "lfo", id: "pitch_wobble", rate: 0.12, depth: 8, wave: "sine" },

      // Slow stereo drift
      { type: "lfo", id: "pan_drift", rate: 0.08, depth: 0.4, wave: "sine" },
    ],
    routing: [
      // Breathing bass
      { from: "bass_breath", to: "sub", param: "gain" },

      // Fading high
      { from: "high_fade", to: "high", param: "gain" },

      // Gentle frequency drifts
      { from: "bass_drift", to: "sub", param: "frequency" },
      { from: "pitch_wobble", to: "high", param: "frequency" },

      // Subtle pan movement
      { from: "pan_drift", to: "high", param: "pan" },
    ],
    effects: [
      // Soft lowpass to warm everything
      { type: "filter", filterType: "lowpass", freq: 6000, q: 1 },

      // Long delay for space
      { type: "delay", time: 0.5, feedback: 0.2 },

      // Very spacious reverb
    ],
  },

  "50 - Low/High Contrast D (Build)": {
    oscillators: [
      // Dual bass - harmonically related
      { id: "sub", freq: 55, gain: 0.2, type: "sine", pan: -0.3 },
      { id: "bass", freq: 110, gain: 0.16, type: "triangle", pan: 0.3 },

      // Mid-range bridge (fills the gap slightly)
      { id: "mid", freq: 880, gain: 0.08, type: "sawtooth", pan: 0 },

      // High cluster
      { id: "high1", freq: 3300, gain: 0.11, type: "sine", pan: -0.6 },
      { id: "high2", freq: 4400, gain: 0.09, type: "sine", pan: 0.6 },
    ],
    noise: [
      // Building texture
      { id: "texture", gain: 0.06, pan: 0 },
    ],
    modulators: [
      // Bass - medium pulse
      { type: "lfo", id: "bass_pulse", rate: 0.8, depth: 0.16, wave: "sine" },

      // Mid element - ascending pattern
      { type: "lfo", id: "mid_rise", rate: 0.15, depth: 0.06, wave: "sine" },

      // High shimmer - moderate speed
      { type: "lfo", id: "shimmer1", rate: 5.5, depth: 0.09, wave: "sine" },
      { type: "lfo", id: "shimmer2", rate: 6.8, depth: 0.07, wave: "sine" },

      // Mid frequency sweep - rising tension
      { type: "lfo", id: "mid_sweep", rate: 0.2, depth: 120, wave: "sine" },

      // Stereo expansion - widening
      { type: "lfo", id: "stereo_widen", rate: 0.12, depth: 0.6, wave: "sine" },

      // Bass drift
      { type: "lfo", id: "bass_drift", rate: 0.09, depth: 7, wave: "sine" },
    ],
    routing: [
      // Bass pulse
      { from: "bass_pulse", to: "sub", param: "gain" },
      { from: "bass_pulse", to: "bass", param: "gain" },

      // Mid element rising
      { from: "mid_rise", to: "mid", param: "gain" },
      { from: "mid_sweep", to: "mid", param: "frequency" },

      // High shimmer
      { from: "shimmer1", to: "high1", param: "gain" },
      { from: "shimmer2", to: "high2", param: "gain" },

      // Stereo widening
      { from: "stereo_widen", to: "high1", param: "pan" },
      { from: "stereo_widen", to: "high2", param: "pan" },

      // Bass drift
      { from: "bass_drift", to: "sub", param: "frequency" },
    ],
    effects: [
      // Moderate highpass
      { type: "filter", filterType: "highpass", freq: 2500, q: 1.5 },

      // Medium delay
      { type: "delay", time: 0.3, feedback: 0.35 },

      // Building reverb
    ],
  },

  "51 - Low/High Contrast E (Resolution)": {
    oscillators: [
      // Deep foundation - doubled for richness
      { id: "sub1", freq: 55, gain: 0.16, type: "sine", pan: -0.2 },
      { id: "sub2", freq: 55.5, gain: 0.16, type: "sine", pan: 0.2 },
      { id: "bass", freq: 165, gain: 0.14, type: "triangle", pan: 0 },

      // High harmonic spectrum - consonant cluster
      { id: "high1", freq: 3300, gain: 0.08, type: "sine", pan: -0.7 },
      { id: "high2", freq: 3960, gain: 0.07, type: "sine", pan: 0 },
      { id: "high3", freq: 4950, gain: 0.06, type: "sine", pan: 0.7 },
      { id: "high4", freq: 6600, gain: 0.04, type: "sine", pan: -0.4 },
    ],
    noise: [
      // Gentle wash
      { id: "wash", gain: 0.05, pan: 0 },
    ],
    modulators: [
      // Very slow bass swell - resolving
      { type: "lfo", id: "bass_swell", rate: 0.18, depth: 0.12, wave: "sine" },

      // Detuned oscillator beating (slow)
      { type: "lfo", id: "detune_beat", rate: 0.5, depth: 0.04, wave: "sine" },

      // High cascade - gentle pulsing
      { type: "lfo", id: "cascade1", rate: 2.8, depth: 0.06, wave: "sine" },
      { type: "lfo", id: "cascade2", rate: 3.5, depth: 0.05, wave: "sine" },
      { type: "lfo", id: "cascade3", rate: 4.2, depth: 0.04, wave: "sine" },

      // Bass frequency - settling
      { type: "lfo", id: "bass_settle", rate: 0.05, depth: 4, wave: "sine" },

      // Subtle stereo breathing
      { type: "lfo", id: "stereo_breath", rate: 0.1, depth: 0.3, wave: "sine" },
    ],
    routing: [
      // Bass swell
      { from: "bass_swell", to: "sub1", param: "gain" },
      { from: "bass_swell", to: "sub2", param: "gain" },
      { from: "bass_swell", to: "bass", param: "gain" },

      // Detune beating effect
      { from: "detune_beat", to: "sub1", param: "gain" },

      // High cascade
      { from: "cascade1", to: "high1", param: "gain" },
      { from: "cascade1", to: "high2", param: "gain" },
      { from: "cascade2", to: "high3", param: "gain" },
      { from: "cascade3", to: "high4", param: "gain" },

      // Bass settling
      { from: "bass_settle", to: "sub1", param: "frequency" },

      // Stereo breathing
      { from: "stereo_breath", to: "high1", param: "pan" },
      { from: "stereo_breath", to: "high3", param: "pan" },
    ],
    effects: [
      // Open highpass - airy
      { type: "filter", filterType: "highpass", freq: 3000, q: 1 },

      // Long, warm delay
      { type: "delay", time: 0.6, feedback: 0.25 },

      // Cathedral reverb
    ],
  },

  "52 - Noise Rhythm: Intro": {
    oscillators: [
      // Low sub foundation
      { id: "sub", freq: 55, gain: 0.15, type: "sine", pan: 0 },
    ],
    noise: [
      // Sparse high clicks
      { id: "click1", gain: 0.12, pan: -0.6 },
      { id: "click2", gain: 0.1, pan: 0.6 },
      // Low rumble
      { id: "rumble", gain: 0.08, pan: 0 },
    ],
    modulators: [
      // Slow sub pulse
      { type: "lfo", id: "sub_pulse", rate: 0.5, depth: 0.12, wave: "sine" },

      // Sparse rhythmic gates - short attacks
      { type: "lfo", id: "gate1", rate: 1.8, depth: 0.12, wave: "square" },
      { type: "lfo", id: "gate2", rate: 2.4, depth: 0.1, wave: "square" },
      {
        type: "lfo",
        id: "rumble_gate",
        rate: 1.2,
        depth: 0.08,
        wave: "square",
      },

      // Filter sweep for pitch variation
      { type: "lfo", id: "pitch1", rate: 0.15, depth: 1500, wave: "sine" },
      { type: "lfo", id: "pitch2", rate: 0.22, depth: 1200, wave: "sine" },
    ],
    routing: [
      // Sub breathing
      { from: "sub_pulse", to: "sub", param: "gain" },

      // Sharp noise gates
      { from: "gate1", to: "click1", param: "gain" },
      { from: "gate2", to: "click2", param: "gain" },
      { from: "rumble_gate", to: "rumble", param: "gain" },
    ],
    effects: [
      // High click emphasis
      { type: "filter", filterType: "highpass", freq: 2500, q: 3 },

      // Short delay for space
      { type: "delay", time: 0.2, feedback: 0.2 },

      // Moderate reverb
    ],
  },

  "53 - Noise Rhythm: Part A": {
    oscillators: [
      // Low foundation
      { id: "sub", freq: 55, gain: 0.18, type: "sine", pan: 0 },
      { id: "bass", freq: 110, gain: 0.14, type: "triangle", pan: 0 },
    ],
    noise: [
      // Polyrhythmic noise hits - different pitch ranges
      { id: "high1", gain: 0.14, pan: -0.7 },
      { id: "high2", gain: 0.12, pan: 0.7 },
      { id: "mid", gain: 0.1, pan: -0.3 },
      { id: "low", gain: 0.11, pan: 0.3 },
    ],
    modulators: [
      // Bass rhythm
      { type: "lfo", id: "bass_gate", rate: 2.5, depth: 0.14, wave: "square" },

      // Polyrhythmic noise gates (3:4:5:7 relationship)
      { type: "lfo", id: "gate1", rate: 4.5, depth: 0.14, wave: "square" }, // 3
      { type: "lfo", id: "gate2", rate: 6.0, depth: 0.12, wave: "square" }, // 4
      { type: "lfo", id: "gate3", rate: 7.5, depth: 0.1, wave: "square" }, // 5
      { type: "lfo", id: "gate4", rate: 10.5, depth: 0.11, wave: "square" }, // 7

      // Pitch variations via filter sweeps
      { type: "lfo", id: "pitch_high", rate: 0.3, depth: 2000, wave: "sine" },
      { type: "lfo", id: "pitch_mid", rate: 0.4, depth: 800, wave: "triangle" },

      // Sub drift
      { type: "lfo", id: "sub_drift", rate: 0.08, depth: 6, wave: "sine" },
    ],
    routing: [
      // Bass pulse
      { from: "bass_gate", to: "bass", param: "gain" },

      // Polyrhythmic noise gates
      { from: "gate1", to: "high1", param: "gain" },
      { from: "gate2", to: "high2", param: "gain" },
      { from: "gate3", to: "mid", param: "gain" },
      { from: "gate4", to: "low", param: "gain" },

      // Sub drift
      { from: "sub_drift", to: "sub", param: "frequency" },
    ],
    effects: [
      // Bandpass for focused noise
      { type: "filter", filterType: "bandpass", freq: 2800, q: 4 },

      // Rhythmic delay
      { type: "delay", time: 0.167, feedback: 0.3 },

      // Tight reverb
    ],
  },

  "54 - Noise Rhythm: Part B (Complex)": {
    oscillators: [
      // Low anchor
      { id: "sub", freq: 55, gain: 0.16, type: "sine", pan: -0.2 },
      { id: "bass", freq: 82.5, gain: 0.14, type: "sine", pan: 0.2 },
      // High tone for contrast
      { id: "high", freq: 3520, gain: 0.08, type: "sine", pan: 0 },
    ],
    noise: [
      // Dense polyrhythmic layer
      { id: "click1", gain: 0.15, pan: -0.8 },
      { id: "click2", gain: 0.14, pan: 0.8 },
      { id: "click3", gain: 0.13, pan: -0.4 },
      { id: "click4", gain: 0.12, pan: 0.4 },
      { id: "click5", gain: 0.11, pan: 0 },
      { id: "rumble", gain: 0.1, pan: 0 },
    ],
    modulators: [
      // Complex polyrhythm (5:6:7:8:9:11 relationship)
      { type: "lfo", id: "gate1", rate: 6.0, depth: 0.15, wave: "square" },
      { type: "lfo", id: "gate2", rate: 7.2, depth: 0.14, wave: "square" },
      { type: "lfo", id: "gate3", rate: 8.4, depth: 0.13, wave: "square" },
      { type: "lfo", id: "gate4", rate: 9.6, depth: 0.12, wave: "square" },
      { type: "lfo", id: "gate5", rate: 10.8, depth: 0.11, wave: "square" },
      { type: "lfo", id: "rumble_gate", rate: 3.3, depth: 0.1, wave: "square" },

      // Fast pitch modulation
      { type: "lfo", id: "pitch_sweep", rate: 0.5, depth: 2500, wave: "sine" },

      // Bass polyrhythm
      { type: "lfo", id: "bass_gate1", rate: 3.5, depth: 0.14, wave: "square" },
      { type: "lfo", id: "bass_gate2", rate: 4.7, depth: 0.12, wave: "square" },

      // High shimmer
      { type: "lfo", id: "high_trem", rate: 8.5, depth: 0.06, wave: "sine" },
    ],
    routing: [
      // Noise gates
      { from: "gate1", to: "click1", param: "gain" },
      { from: "gate2", to: "click2", param: "gain" },
      { from: "gate3", to: "click3", param: "gain" },
      { from: "gate4", to: "click4", param: "gain" },
      { from: "gate5", to: "click5", param: "gain" },
      { from: "rumble_gate", to: "rumble", param: "gain" },

      // Bass rhythm
      { from: "bass_gate1", to: "sub", param: "gain" },
      { from: "bass_gate2", to: "bass", param: "gain" },

      // High modulation
      { from: "high_trem", to: "high", param: "gain" },
    ],
    effects: [
      // Sharp highpass for clarity
      { type: "filter", filterType: "highpass", freq: 1800, q: 2 },

      // Complex delay pattern
      { type: "delay", time: 0.125, feedback: 0.4 },

      // Metallic reverb
    ],
  },

  "55 - Noise Rhythm: Part C (Quiet)": {
    oscillators: [
      // Minimal low drone
      { id: "sub", freq: 55, gain: 0.12, type: "sine", pan: 0 },
    ],
    noise: [
      // Sparse clicks - widely spaced
      { id: "click1", gain: 0.08, pan: -0.5 },
      { id: "click2", gain: 0.07, pan: 0.5 },
      { id: "texture", gain: 0.05, pan: 0 },
    ],
    modulators: [
      // Very slow sub breathing
      { type: "lfo", id: "sub_breath", rate: 0.3, depth: 0.1, wave: "sine" },

      // Sparse gates - long gaps
      { type: "lfo", id: "gate1", rate: 1.3, depth: 0.08, wave: "square" },
      { type: "lfo", id: "gate2", rate: 0.9, depth: 0.07, wave: "square" },
      { type: "lfo", id: "texture_gate", rate: 0.5, depth: 0.05, wave: "sine" },

      // Slow pitch drift
      { type: "lfo", id: "pitch_drift", rate: 0.12, depth: 800, wave: "sine" },

      // Sub drift
      { type: "lfo", id: "sub_drift", rate: 0.06, depth: 4, wave: "sine" },
    ],
    routing: [
      // Sub breathing
      { from: "sub_breath", to: "sub", param: "gain" },
      { from: "sub_drift", to: "sub", param: "frequency" },

      // Sparse gates
      { from: "gate1", to: "click1", param: "gain" },
      { from: "gate2", to: "click2", param: "gain" },
      { from: "texture_gate", to: "texture", param: "gain" },
    ],
    effects: [
      // Soft highpass
      { type: "filter", filterType: "highpass", freq: 3500, q: 1 },

      // Long delay for space
      { type: "delay", time: 0.45, feedback: 0.2 },

      // Expansive reverb
    ],
  },

  "56 - Noise Rhythm: Outro": {
    oscillators: [
      // Settling low drones
      { id: "sub", freq: 55, gain: 0.14, type: "sine", pan: -0.1 },
      { id: "bass", freq: 110, gain: 0.12, type: "sine", pan: 0.1 },
      // Final high breath
      { id: "high", freq: 4400, gain: 0.06, type: "sine", pan: 0 },
    ],
    noise: [
      // Fading clicks
      { id: "click1", gain: 0.09, pan: -0.6 },
      { id: "click2", gain: 0.08, pan: 0.6 },
      { id: "wash", gain: 0.06, pan: 0 },
    ],
    modulators: [
      // Slow fadeout breathing
      { type: "lfo", id: "fade_breath", rate: 0.2, depth: 0.12, wave: "sine" },

      // Slowing rhythm - decelerating
      { type: "lfo", id: "gate1", rate: 2.2, depth: 0.09, wave: "square" },
      { type: "lfo", id: "gate2", rate: 1.5, depth: 0.08, wave: "square" },

      // Final wash fade
      { type: "lfo", id: "wash_fade", rate: 0.15, depth: 0.06, wave: "sine" },

      // High tone fade
      { type: "lfo", id: "high_fade", rate: 0.18, depth: 0.05, wave: "sine" },

      // Bass drift - settling
      { type: "lfo", id: "bass_drift", rate: 0.05, depth: 5, wave: "sine" },

      // Pitch resolution
      {
        type: "lfo",
        id: "pitch_resolve",
        rate: 0.1,
        depth: 1000,
        wave: "sine",
      },
    ],
    routing: [
      // Breathing fade
      { from: "fade_breath", to: "sub", param: "gain" },
      { from: "fade_breath", to: "bass", param: "gain" },

      // Decelerating clicks
      { from: "gate1", to: "click1", param: "gain" },
      { from: "gate2", to: "click2", param: "gain" },

      // Fading elements
      { from: "wash_fade", to: "wash", param: "gain" },
      { from: "high_fade", to: "high", param: "gain" },

      // Bass settling
      { from: "bass_drift", to: "sub", param: "frequency" },
    ],
    effects: [
      // Opening highpass
      { type: "filter", filterType: "highpass", freq: 2200, q: 1.5 },

      // Long, fading delay
      { type: "delay", time: 0.5, feedback: 0.3 },

      // Deep reverb tail
    ],
  },

  "57 - Percussive Beat": {
    oscillators: [
      // Kick drum - deep punch
      { id: "kick", freq: 55, gain: 0.3, type: "sine", pan: 0 },
      // Tom 1
      { id: "tom1", freq: 180, gain: 0.18, type: "triangle", pan: -0.4 },
      // Tom 2
      { id: "tom2", freq: 140, gain: 0.16, type: "triangle", pan: 0.4 },
      // Bass tone
      { id: "bass", freq: 110, gain: 0.12, type: "triangle", pan: 0 },
    ],
    noise: [
      // Snare/clap
      { id: "snare", gain: 0.2, pan: 0 },
      // Hi-hat
      { id: "hihat", gain: 0.14, pan: 0.3 },
      // Crash texture
      { id: "crash", gain: 0.08, pan: -0.3 },
    ],
    modulators: [
      // Kick pattern - 4 on the floor at 2 Hz (120 BPM)
      { type: "lfo", id: "kick_gate", rate: 2.0, depth: 0.3, wave: "square" },
      // Kick pitch envelope
      { type: "lfo", id: "kick_pitch", rate: 8.0, depth: 35, wave: "square" },

      // Snare - on 2 and 4 (half-time)
      { type: "lfo", id: "snare_gate", rate: 1.0, depth: 0.2, wave: "square" },

      // Hi-hat - 8th notes (double time)
      { type: "lfo", id: "hihat_gate", rate: 4.0, depth: 0.14, wave: "square" },

      // Tom fills - polyrhythmic
      { type: "lfo", id: "tom1_gate", rate: 1.3, depth: 0.18, wave: "square" },
      { type: "lfo", id: "tom2_gate", rate: 1.7, depth: 0.16, wave: "square" },

      // Crash accent - slow
      { type: "lfo", id: "crash_gate", rate: 0.5, depth: 0.08, wave: "square" },

      // Bass groove - syncopated
      { type: "lfo", id: "bass_gate", rate: 3.0, depth: 0.12, wave: "square" },

      // Filter modulation for snare character
      {
        type: "lfo",
        id: "snare_filter",
        rate: 4.0,
        depth: 800,
        wave: "square",
      },
    ],
    routing: [
      // Kick drum with pitch drop
      { from: "kick_gate", to: "kick", param: "gain" },
      { from: "kick_pitch", to: "kick", param: "frequency" },

      // Snare hit
      { from: "snare_gate", to: "snare", param: "gain" },

      // Hi-hat pattern
      { from: "hihat_gate", to: "hihat", param: "gain" },

      // Tom fills
      { from: "tom1_gate", to: "tom1", param: "gain" },
      { from: "tom2_gate", to: "tom2", param: "gain" },

      // Crash accents
      { from: "crash_gate", to: "crash", param: "gain" },

      // Bass groove
      { from: "bass_gate", to: "bass", param: "gain" },
    ],
    effects: [
      // Bandpass for snare snap
      { type: "filter", filterType: "bandpass", freq: 1200, q: 3 },

      // Short delay for groove
      { type: "delay", time: 0.125, feedback: 0.25 },
    ],
  },

  "58 - Beat Example (Sequenced)": {
    tempo: 120,
    oscillators: [],
    noise: [],
    voices: [
      {
        id: "kick",
        source: { type: "oscillator", freq: 60, wave: "sine" },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
        sequence: { pattern: [1, 0, 0, 0, 1, 0, 0, 0], rate: 4 },
        gain: 0.8,
        pan: 0,
      },
      {
        id: "snare",
        source: { type: "noise" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
        sequence: { pattern: [0, 0, 1, 0, 0, 0, 1, 0], rate: 4 },
        gain: 0.6,
        pan: 0,
        filter: { type: "bandpass", freq: 1200, q: 3 },
      },
      {
        id: "hihat",
        source: { type: "noise" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
        sequence: { pattern: [1, 0, 1, 0, 1, 0, 1, 0], rate: 8 },
        gain: 0.4,
        pan: 0.3,
        filter: { type: "highpass", freq: 8000, q: 1 },
      },
    ],
    modulators: [],
    routing: [],
    effects: [],
  },

  "59 - Hybrid Drone + Beat": {
    tempo: 120,
    oscillators: [
      { id: "drone", freq: 110, gain: 0.2, type: "triangle", pan: 0 },
    ],
    noise: [{ id: "atmosphere", gain: 0.08, pan: 0 }],
    voices: [
      {
        id: "kick",
        source: { type: "oscillator", freq: 55, wave: "sine" },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
        sequence: { pattern: [1, 0, 0, 0, 1, 0, 0, 0], rate: 3 },
        gain: 0.7,
        pan: 0,
      },
      {
        id: "perc",
        source: { type: "noise" },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
        sequence: { pattern: [0, 1, 0, 1, 0, 1, 0, 1], rate: 5 },
        gain: 0.3,
        pan: 0.6,
        filter: { type: "highpass", freq: 3000, q: 2 },
      },
    ],
    modulators: [
      { type: "lfo", id: "drone_mod", rate: 0.3, depth: 0.15, wave: "sine" },
    ],
    routing: [{ from: "drone_mod", to: "drone", param: "gain" }],
    effects: [],
  },

  "60 - Techno Groove (Sequenced)": {
    tempo: 135,
    oscillators: [],
    noise: [],
    voices: [
      {
        id: "kick",
        source: { type: "oscillator", freq: 50, wave: "sine" },
        envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 },
        sequence: {
          pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
          rate: 4,
        },
        gain: 0.9,
        pan: 0,
      },
      {
        id: "clap",
        source: { type: "noise" },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
        sequence: {
          pattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
          rate: 4,
        },
        gain: 0.5,
        pan: 0,
        filter: { type: "bandpass", freq: 1500, q: 2 },
      },
      {
        id: "hat_closed",
        source: { type: "noise" },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
        sequence: { pattern: [1, 0, 1, 0, 1, 0, 1, 0], rate: 8 },
        gain: 0.3,
        pan: -0.3,
        filter: { type: "highpass", freq: 10000, q: 1 },
      },
      {
        id: "hat_open",
        source: { type: "noise" },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
        sequence: { pattern: [0, 0, 0, 0, 0, 0, 1, 0], rate: 8 },
        gain: 0.35,
        pan: 0.3,
        filter: { type: "highpass", freq: 7000, q: 1 },
      },
      {
        id: "rim",
        source: { type: "oscillator", freq: 800, wave: "triangle" },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
        sequence: {
          pattern: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
          rate: 4,
        },
        gain: 0.4,
        pan: -0.6,
        filter: { type: "bandpass", freq: 1800, q: 5 },
      },
    ],
    modulators: [],
    routing: [],
    effects: [],
  },

  "61 - Sequencer Test (Kick Drum)": {
    tempo: 120,
    oscillators: [],
    noise: [],
    voices: [
      {
        id: "kick",
        source: { type: "oscillator", freq: 150, wave: "sine" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0.1, release: 0.05 },
        sequence: { pattern: [1, 0, 0, 1, 0, 0, 1, 0], rate: 8 },
        gain: 0.7,
        pan: 0,
      },
    ],
    modulators: [],
    routing: [],
    effects: [],
  },

  "62 - Sequencer Test B (3:4 Polyrhythm)": {
    tempo: 120,
    oscillators: [],
    noise: [],
    voices: [
      {
        id: "bass",
        source: { type: "oscillator", freq: 220, wave: "sine" },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0.2, release: 0.03 },
        sequence: { pattern: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0], rate: 12 },
        gain: 0.7,
        pan: -0.3,
      },
      {
        id: "mid",
        source: { type: "oscillator", freq: 440, wave: "triangle" },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0.15, release: 0.02 },
        sequence: { pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], rate: 12 },
        gain: 0.5,
        pan: 0,
      },
      {
        id: "treble",
        source: { type: "oscillator", freq: 880, wave: "sine" },
        envelope: { attack: 0.0005, decay: 0.04, sustain: 0.1, release: 0.015 },
        sequence: { pattern: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0], rate: 12 },
        gain: 0.4,
        pan: 0.3,
      },
    ],
    modulators: [],
    routing: [],
    effects: [],
  },
};

export const patchNames = Object.keys(patches);
*/
