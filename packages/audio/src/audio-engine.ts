/**
 * Audio Engine for Live Coding
 * Handles Web Audio API context and node management
 */

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

class AudioEngine {
  [key: string]: any;
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.softClipper = null;
    this.limiter = null;
    this.isRunning = false;

    // Worklet / WASM DSP (optional)
    this.useWorklet = false;
    this.workletA = null;
    this.workletB = null;
    this.workletReady = false;

    // Track active nodes for cleanup
    this.activeNodes = [];
    this.activeOscillators = [];

    // Pre-generated noise buffer
    this.noiseBuffer = null;

    // Sequencer state
    this.activeSequences = [];
    this.activeVoices = new Map(); // Track voice instances

    // Queued voice updates (applied on next beat)
    this.pendingVoiceUpdates = new Map();

    // Global clock for rhythm preservation
    this.globalClock = null;
    this.clockStartTime = 0;

    // A/B Channel crossfading
    this.channelA = null; // Current active channel
    this.channelB = null; // Standby channel
    this.activeChannel = "A"; // Which channel is currently active
    this.pendingChannelSwap = false; // Flag to swap on next beat
    this.channelAInput = null;
    this.channelBInput = null;
    this.channelAEffects = null;
    this.channelBEffects = null;

    // Object pools for reusable nodes (per channel)
    this.poolA = {
      oscillators: [],
      noise: [],
    };
    this.poolB = {
      oscillators: [],
      noise: [],
    };
    const POOL_SIZE = 32; // Max oscillators per channel
    const NOISE_POOL_SIZE = 8; // Max noise sources per channel
    this.POOL_SIZE = POOL_SIZE;
    this.NOISE_POOL_SIZE = NOISE_POOL_SIZE;

    // Tail hold after crossfade (seconds)
    this.tailHoldTime = 0.3;

    // Mixer channels
    this.mixer = {
      channels: new Map(),
      masterGain: null,
    };
  }

  /**
   * Initialize audio context and master chain
   */
  async init() {
    if (this.audioContext) {
      // Already initialized; ensure it's running when called from a user gesture
      await this.resume();
      return this.audioContext;
    }

    this.audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();

    // Load AudioWorklet module (optional)
    if (this.useWorklet && this.audioContext.audioWorklet) {
      try {
        const workletUrl = new URL("../worklet/dsp-worklet.js", import.meta.url);
        await this.audioContext.audioWorklet.addModule(workletUrl);
      } catch (error) {
        console.warn("[Worklet] Failed to load worklet module:", error);
        this.useWorklet = false;
      }
    } else {
      this.useWorklet = false;
    }

    // Create master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.7; // Safe default volume

    // Safety chain: soft clip + limiter
    this.softClipper = this.createSoftClipper();
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 10;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;

    this.masterGain.connect(this.softClipper);
    this.softClipper.connect(this.limiter);
    this.limiter.connect(this.audioContext.destination);

    // Create A/B channels for crossfading
    this.channelA = this.audioContext.createGain();
    this.channelA.gain.value = 1.0; // Channel A starts active
    this.channelA.connect(this.masterGain);

    this.channelB = this.audioContext.createGain();
    this.channelB.gain.value = 0.0; // Channel B starts silent
    this.channelB.connect(this.masterGain);

    // Per-channel inputs for effects routing
    this.channelAInput = this.audioContext.createGain();
    this.channelAInput.gain.value = 1.0;
    this.channelAInput.connect(this.channelA);

    this.channelBInput = this.audioContext.createGain();
    this.channelBInput.gain.value = 1.0;
    this.channelBInput.connect(this.channelB);

    // Create worklet nodes (one per channel) if enabled
    if (this.useWorklet) {
      this.workletA = new AudioWorkletNode(this.audioContext, "dsp-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.workletB = new AudioWorkletNode(this.audioContext, "dsp-worklet", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      const handleWorkletMessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === "status") {
    } else if (data.type === "error") {
        }
      };
      this.workletA.port.onmessage = handleWorkletMessage;
      this.workletB.port.onmessage = handleWorkletMessage;

      this.workletA.connect(this.channelA);
      this.workletB.connect(this.channelB);
      this.workletReady = true;

      this.workletA.port.postMessage({ type: "ping" });
      this.workletB.port.postMessage({ type: "ping" });

    } else {
      this.workletReady = false;
    }

    // Initialize mixer master
    this.mixer.masterGain = this.masterGain;

    // Pre-generate noise buffer BEFORE initializing pools
    this.generateNoiseBuffer();

    // Initialize object pools for both channels
    this.initializePool(this.poolA, this.channelAInput);
    this.initializePool(this.poolB, this.channelBInput);

    // Start global clock if not running
    if (!this.globalClock) {
      this.startGlobalClock();
    }

    this.isRunning = true;
    return this.audioContext;
  }

  /**
   * Generate white noise buffer
   */
  generateNoiseBuffer() {
    const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds
    this.noiseBuffer = this.audioContext.createBuffer(
      1,
      bufferSize,
      this.audioContext.sampleRate,
    );

    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  /**
   * Initialize object pool for a channel
   */
  initializePool(pool, channelInput) {
    // Create oscillator pool
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner();

      osc.connect(gain);
      gain.connect(panner);
      panner.connect(channelInput);

      gain.gain.value = 0; // Start silent
      const startTime = this.getCurrentTime();
      osc.start(startTime);

      const poolItem = {
        osc,
        gain,
        panner,
        active: false,
      };
      pool.oscillators.push(poolItem);

      // Verify structure
    }

    // Create noise pool (BufferSources)
    for (let i = 0; i < this.NOISE_POOL_SIZE; i++) {
      if (!this.noiseBuffer) {
        console.error("[Pool] Noise buffer not initialized!");
        break;
      }

      // Create a new noise BufferSource (createNoise already creates and loops it)
      const source = this.audioContext.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;

      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner();

      source.connect(gain);
      gain.connect(panner);
      panner.connect(channelInput);

      gain.gain.value = 0; // Start silent
      source.start(this.getCurrentTime());

      this.activeNodes.push(source);

      pool.noise.push({
        noise: source,
        gain,
        panner,
        active: false,
      });
    }

  }

  /**
   * Get an oscillator from the pool for a channel
   */
  getPooledOscillator(channel) {
    const pool = channel === this.channelA ? this.poolA : this.poolB;
    if (!pool.oscillators || pool.oscillators.length === 0) {
      console.error("[Pool] Pool is empty or undefined!");
      return null;
    }

    const item = pool.oscillators.find((o) => !o.active);
    if (!item) {
      console.warn("[Pool] No available oscillators in pool!");
      return null;
    }


    // Clear scheduled automation before reuse
    const now = this.audioContext.currentTime;
    if (item.osc?.frequency) {
      item.osc.frequency.cancelScheduledValues(now);
      item.osc.frequency.setValueAtTime(item.osc.frequency.value, now);
    }
    if (item.osc?.detune) {
      item.osc.detune.cancelScheduledValues(now);
      item.osc.detune.setValueAtTime(item.osc.detune.value, now);
    }
    if (item.gain?.gain) {
      item.gain.gain.cancelScheduledValues(now);
      item.gain.gain.setValueAtTime(0, now);
    }
    if (item.panner?.pan) {
      item.panner.pan.cancelScheduledValues(now);
      item.panner.pan.setValueAtTime(item.panner.pan.value, now);
    }

    item.active = true;
    return item;
  }

  /**
   * Release an oscillator back to the pool
   */
  releasePooledOscillator(oscillatorItem) {
    if (oscillatorItem) {
      oscillatorItem.active = false;
      oscillatorItem.gain.gain.value = 0;
    }
  }

  /**
   * Get a noise source from the pool for a channel
   */
  getPooledNoise(channel) {
    const pool = channel === this.channelA ? this.poolA : this.poolB;
    if (!pool.noise || pool.noise.length === 0) {
      console.error("[Pool] Noise pool is empty or undefined!");
      return null;
    }

    const item = pool.noise.find((n) => !n.active);
    if (!item) {
      console.warn("[Pool] No available noise sources in pool!");
      return null;
    }


    // Clear scheduled automation before reuse
    const now = this.audioContext.currentTime;
    if (item.gain?.gain) {
      item.gain.gain.cancelScheduledValues(now);
      item.gain.gain.setValueAtTime(0, now);
    }
    if (item.panner?.pan) {
      item.panner.pan.cancelScheduledValues(now);
      item.panner.pan.setValueAtTime(item.panner.pan.value, now);
    }

    item.active = true;
    return item;
  }

  /**
   * Release a noise source back to the pool
   */
  releasePooledNoise(noiseItem) {
    if (noiseItem) {
      noiseItem.active = false;
      noiseItem.gain.gain.value = 0;
    }
  }

  /**
   * Reset all sources in a pool (disable them all)
   */
  resetPool(channel) {
    const pool = channel === this.channelA ? this.poolA : this.poolB;
    const now = this.audioContext.currentTime;

    // Disable all oscillators
    pool.oscillators.forEach((item) => {
      item.active = false;
      if (item.gain?.gain) {
        item.gain.gain.cancelScheduledValues(now);
        item.gain.gain.setValueAtTime(0, now);
      }
      if (item.osc?.frequency) {
        item.osc.frequency.cancelScheduledValues(now);
      }
      if (item.osc?.detune) {
        item.osc.detune.cancelScheduledValues(now);
      }
      if (item.panner?.pan) {
        item.panner.pan.cancelScheduledValues(now);
      }
    });

    // Disable all noise sources
    pool.noise.forEach((item) => {
      item.active = false;
      if (item.gain?.gain) {
        item.gain.gain.cancelScheduledValues(now);
        item.gain.gain.setValueAtTime(0, now);
      }
      if (item.panner?.pan) {
        item.panner.pan.cancelScheduledValues(now);
      }
    });

  }

  /**
   * Start global clock for rhythm synchronization
   */
  startGlobalClock() {
    this.clockStartTime = Date.now();
    // Clock runs at 1ms precision for accurate timing
    this.globalClock = setInterval(() => {
      // Clock just ticks, actual timing is calculated on demand
    }, 1);
  }

  /**
   * Get current time in milliseconds since clock started
   */
  getClockTime() {
    return Date.now() - this.clockStartTime;
  }

  /**
   * Stop audio context
   */
  stop() {
    this.cleanup(0, false); // Full cleanup on stop
    this.cleanupSequencers(false);

    if (this.audioContext) {
      this.audioContext.suspend();
      this.isRunning = false;
    }

    // Stop global clock
    if (this.globalClock) {
      clearInterval(this.globalClock);
      this.globalClock = null;
    }
  }

  /**
   * Fully reset audio context so worklet mode can be toggled
   */
  async reset() {
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {
        // ignore
      }
    }
    this.audioContext = null;
    this.masterGain = null;
    this.softClipper = null;
    this.limiter = null;
    this.channelA = null;
    this.channelB = null;
    this.channelAInput = null;
    this.channelBInput = null;
    this.channelAEffects = null;
    this.channelBEffects = null;
    this.workletA = null;
    this.workletB = null;
    this.workletReady = false;
    this.isRunning = false;
    this.pendingChannelSwap = false;
    this.activeNodes = [];
    this.activeOscillators = [];
    this.activeSequences = [];
    this.activeVoices.clear();
    this.pendingVoiceUpdates.clear();
    this.noiseBuffer = null;
    this.poolA = { oscillators: [], noise: [] };
    this.poolB = { oscillators: [], noise: [] };
  }

  /**
   * Resume audio context
   */
  async resume() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
      this.isRunning = true;
    }
  }

  /**
   * Clean up all active nodes and oscillators
   * @param {number} fadeTime - Optional fade out time in seconds (0 for immediate)
   * @param {boolean} preserveRhythm - Keep sequencer state for rhythm preservation
   * @param {boolean} preserveVoices - Don't clean up voice nodes (for hot-swap)
   */
  cleanup(fadeTime = 0.05, preserveRhythm = false, preserveVoices = false) {
    if (fadeTime > 0 && this.masterGain) {
      // Store nodes to clean up after fade
      let nodesToCleanup = [...this.activeNodes];
      let oscillatorsToStop = [...this.activeOscillators];

      // Filter out voice-related nodes if preserving voices
      if (preserveVoices) {
        // Don't clean up nodes that are part of active voices
        nodesToCleanup = nodesToCleanup.filter((node) => {
          // Check if this node belongs to an active voice
          for (let [voiceId, voice] of this.activeVoices) {
            if (node === voice.voiceGain || node === voice.panner) {
              return false; // Skip this node
            }
          }
          return true; // Clean up this node
        });
      }

      // Clear arrays immediately so new nodes can be added
      this.activeNodes = [];
      this.activeOscillators = [];

      // Create a temporary gain node for fade out
      const fadeGain = this.audioContext.createGain();
      fadeGain.gain.value = 1.0;

      // Reconnect old nodes through fade gain
      nodesToCleanup.forEach((node) => {
        try {
          // Check if node is connected to master
          const connections = node.numberOfOutputs || 0;
          if (connections > 0) {
            node.disconnect(this.masterGain);
            node.connect(fadeGain);
          }
        } catch (e) {
          // Couldn't reconnect
        }
      });

      fadeGain.connect(this.masterGain);

      // Fade out the old nodes
      const currentTime = this.getCurrentTime();
      fadeGain.gain.setValueAtTime(1.0, currentTime);
      fadeGain.gain.linearRampToValueAtTime(0, currentTime + fadeTime);

      // Cleanup after fade completes
      setTimeout(
        () => {
          // Stop all oscillators
          oscillatorsToStop.forEach((osc) => {
            try {
              osc.stop();
              osc.disconnect();
            } catch (e) {
              // Already stopped
            }
          });

          // Disconnect all nodes
          nodesToCleanup.forEach((node) => {
            try {
              node.disconnect();
            } catch (e) {
              // Already disconnected
            }
          });

          // Disconnect fade gain
          try {
            fadeGain.disconnect();
          } catch (e) {
            // Already disconnected
          }
        },
        fadeTime * 1000 + 50,
      );
    } else {
      // Immediate cleanup
      this.activeOscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {
          // Already stopped
        }
      });
      this.activeOscillators = [];

      this.activeNodes.forEach((node) => {
        try {
          node.disconnect();
        } catch (e) {
          // Already disconnected
        }
      });
      this.activeNodes = [];
    }
  }

  /**
   * Get current audio time
   */
  getCurrentTime() {
    return this.audioContext ? this.audioContext.currentTime : 0;
  }

  /**
   * Create and track an oscillator
   */
  createOscillator(frequency = 440, type = "sine") {
    const osc = this.audioContext.createOscillator();
    osc.frequency.value = frequency;
    osc.type = type;

    this.activeOscillators.push(osc);
    this.activeNodes.push(osc);

    return osc;
  }

  /**
   * Create and track a gain node
   */
  createGain(initialValue = 1.0) {
    const gain = this.audioContext.createGain();
    gain.gain.value = initialValue;

    this.activeNodes.push(gain);

    return gain;
  }

  /**   * Create and track a stereo panner node
   * @param {number} pan - Pan value from -1 (left) to 1 (right)
   */
  createPanner(pan = 0) {
    const panner = this.audioContext.createStereoPanner();
    panner.pan.value = pan;
    this.activeNodes.push(panner);
    return panner;
  }

  /**   * Create and track a filter node
   */
  createFilter(type = "lowpass", frequency = 1000, q = 1) {
    const filter = this.audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    this.activeNodes.push(filter);

    return filter;
  }

  /**
   * Create and track a delay node
   */
  createDelay(delayTime = 0.5, feedback = 0.5) {
    const delay = this.audioContext.createDelay(5.0);
    delay.delayTime.value = delayTime;

    const feedbackGain = this.audioContext.createGain();
    feedbackGain.gain.value = feedback;

    delay.connect(feedbackGain);
    feedbackGain.connect(delay);

    this.activeNodes.push(delay);
    this.activeNodes.push(feedbackGain);

    return { delay, feedbackGain };
  }

  /**
   * Create and track a distortion node using waveshaper
   */
  createDistortion(amount = 50) {
    const distortion = this.audioContext.createWaveShaper();
    distortion.curve = this.makeDistortionCurve(amount);
    distortion.oversample = "4x";

    this.activeNodes.push(distortion);

    return distortion;
  }

  /**
   * Create and track a reverb node using convolver
   * @param {number} duration - Reverb duration in seconds (0.5 to 10)
   * @param {number} decay - Decay rate (0.1 to 10)
   * @param {boolean} reverse - Reverse the impulse response
   */
  createReverb(duration = 2, decay = 2, reverse = false) {
    const convolver = this.audioContext.createConvolver();
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);

    // Generate impulse response
    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      leftChannel[i] =
        (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      rightChannel[i] =
        (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }

    convolver.buffer = impulse;
    this.activeNodes.push(convolver);

    return convolver;
  }

  /**
   * Create a compressor node for the effects chain
   */
  createCompressor({
    threshold = -24,
    ratio = 4,
    attack = 0.003,
    release = 0.25,
    knee = 0,
    makeup = 0,
  } = {}) {
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = threshold;
    compressor.ratio.value = ratio;
    compressor.attack.value = attack;
    compressor.release.value = release;
    compressor.knee.value = knee;

    const makeupGain = this.audioContext.createGain();
    makeupGain.gain.value = Math.pow(10, makeup / 20);

    compressor.connect(makeupGain);
    this.activeNodes.push(compressor, makeupGain);

    return { node: compressor, output: makeupGain };
  }

  /**
   * Generate distortion curve
   */
  makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] =
        ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }

  /**
   * Create noise source
   */
  createNoise() {
    const source = this.audioContext.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    this.activeNodes.push(source);

    return source;
  }

  /**
   * Create LFO (Low Frequency Oscillator) for modulation
   * @param {number} rate - LFO frequency in Hz
   * @param {number} depth - Modulation depth
   * @param {string} type - Waveform type
   * @returns {Object} LFO oscillator and gain for depth control
   */
  createLFO(rate = 1, depth = 100, type = "sine") {
    const lfo = this.audioContext.createOscillator();
    lfo.frequency.value = rate;
    lfo.type = type;

    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.value = depth;

    lfo.connect(lfoGain);

    this.activeOscillators.push(lfo);
    this.activeNodes.push(lfoGain);

    return { lfo, gain: lfoGain };
  }

  /**
   * Create sample & hold circuit for stepped random modulation
   * @param {number} rate - Update rate in Hz
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {Object} Constant source node that can be connected to audio params
   */
  createSampleHold(rate = 8, min = 100, max = 2000) {
    const constantNode = this.audioContext.createConstantSource();
    constantNode.offset.value = (min + max) / 2;

    // Update with random values at specified rate
    const intervalMs = 1000 / rate;
    const intervalId = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(intervalId);
        return;
      }
      const randomValue = Math.random() * (max - min) + min;
      const now = this.audioContext.currentTime;
      constantNode.offset.setValueAtTime(randomValue, now);
    }, intervalMs);

    this.activeNodes.push(constantNode);

    return { source: constantNode, stop: () => clearInterval(intervalId) };
  }

  /**
   * Create chaos modulation using random walk
   * @param {number} rate - Update rate in Hz
   * @param {number} center - Center value
   * @param {number} range - Maximum deviation from center
   * @param {number} stepSize - How much to change per step
   * @returns {Object} Constant source node for modulation
   */
  createChaos(rate = 10, center = 500, range = 500, stepSize = 0.2) {
    const constantNode = this.audioContext.createConstantSource();
    let currentValue = center;
    constantNode.offset.value = currentValue;

    const intervalMs = 1000 / rate;
    const intervalId = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(intervalId);
        return;
      }

      // Random walk
      const change = (Math.random() - 0.5) * 2 * stepSize * range;
      currentValue += change;

      // Keep within bounds
      currentValue = Math.max(
        center - range,
        Math.min(center + range, currentValue),
      );

      const now = this.audioContext.currentTime;
      constantNode.offset.linearRampToValueAtTime(
        currentValue,
        now + intervalMs / 1000,
      );
    }, intervalMs);

    this.activeNodes.push(constantNode);

    return { source: constantNode, stop: () => clearInterval(intervalId) };
  }

  /**
   * Create an envelope generator
   * @param {number} attack - Attack time in seconds
   * @param {number} decay - Decay time in seconds
   * @param {number} sustain - Sustain level (0-1)
   * @param {number} release - Release time in seconds
   * @returns {Object} Envelope with node and trigger function
   */
  createEnvelope(attack = 0.01, decay = 0.1, sustain = 0, release = 0.1) {
    const envelope = this.audioContext.createGain();
    envelope.gain.value = 0;

    const trigger = (triggerTime) => {
      const now = triggerTime || this.audioContext.currentTime;
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setValueAtTime(0, now);

      // Attack
      envelope.gain.linearRampToValueAtTime(1, now + attack);

      // Decay to sustain level
      envelope.gain.linearRampToValueAtTime(sustain, now + attack + decay);

      // Release after a brief sustain
      const releaseStart = now + attack + decay + 0.01;
      envelope.gain.setValueAtTime(sustain, releaseStart);
      envelope.gain.linearRampToValueAtTime(0, releaseStart + release);
    };

    this.activeNodes.push(envelope);

    return {
      node: envelope,
      trigger,
    };
  }

  /**
   * Create a sequenced voice with envelope and pattern
   * @param {Object} voiceConfig - Voice configuration
   * @returns {Object} Voice controller with start/stop methods
   */
  createVoice(voiceConfig) {
    let {
      id,
      source,
      envelope: envConfig,
      sequence,
      gain = 1.0,
      pan = 0,
      filter,
      channel,
    } = voiceConfig;

    // Check for existing voice to preserve rhythm
    const existingVoice = this.activeVoices.get(id);
    let preservedState: { currentStep: number; lastStepTime: number } | null =
      null;

    if (existingVoice && existingVoice.sequenceState && sequence) {
      const state = existingVoice.sequenceState;
      // Check if pattern/rate unchanged
      if (
        JSON.stringify(state.pattern) === JSON.stringify(sequence.pattern) &&
        state.rate === sequence.rate
      ) {
        preservedState = {
          currentStep: state.currentStep,
          lastStepTime: state.lastStepTime,
        };
      }
    }

    if (existingVoice?.stopSequence) {
      existingVoice.stopSequence();
    }

    // Create gain for overall voice level
    const voiceGain = this.audioContext.createGain();
    voiceGain.gain.value = gain;

    // Create panner
    const panner = this.createPanner(pan);

    // Build output chain
    voiceGain.connect(panner);
    const targetChannel = channel ?? this.getStandbyChannel();
    const channelInput = this.getChannelInput(targetChannel);
    if (channelInput) {
      panner.connect(channelInput);
    } else if (this.channelAInput) {
      panner.connect(this.channelAInput);
    } else if (this.channelBInput) {
      panner.connect(this.channelBInput);
    }

    // For oscillator sources, create a new one on each trigger
    const triggerVoice = (triggerTime) => {
      const now = triggerTime || this.audioContext.currentTime;

      // Perform channel swap if pending (beat-synced crossfade)
      if (this.pendingChannelSwap) {
        this.performChannelSwap(0.05); // 50ms crossfade on beat
      }

      // Check for pending update and apply it on this beat
      const pendingUpdate = this.pendingVoiceUpdates.get(id);
      if (pendingUpdate) {
        source = pendingUpdate.source;
        envConfig = pendingUpdate.envelope;
        filter = pendingUpdate.filter;
        voiceGain.gain.value = pendingUpdate.gain || voiceGain.gain.value;
        this.pendingVoiceUpdates.delete(id);
      }

      // Create fresh source for this trigger
      let sourceNode;
      if (source.type === "oscillator") {
        sourceNode = this.audioContext.createOscillator();
        sourceNode.frequency.value = source.freq;
        sourceNode.type = source.wave || "sine";
      } else if (source.type === "noise") {
        sourceNode = this.audioContext.createBufferSource();
        sourceNode.buffer = this.noiseBuffer;
        sourceNode.loop = false;
      }

      // Create envelope for this trigger
      const envelope = this.audioContext.createGain();
      envelope.gain.value = 0;

      // Build chain: source -> envelope -> filter? -> voiceGain
      sourceNode.connect(envelope);
      let chainEnd = envelope;

      if (filter) {
        const filterNode = this.createFilter(
          filter.type || "lowpass",
          filter.freq,
          filter.q || 1,
        );
        chainEnd.connect(filterNode);
        chainEnd = filterNode;
      }

      chainEnd.connect(voiceGain);

      // Schedule envelope
      envelope.gain.setValueAtTime(0, now);
      // Attack
      envelope.gain.linearRampToValueAtTime(1, now + envConfig.attack);
      // Decay to sustain
      envelope.gain.linearRampToValueAtTime(
        envConfig.sustain,
        now + envConfig.attack + envConfig.decay,
      );
      // Release
      const releaseStart = now + envConfig.attack + envConfig.decay + 0.01;
      envelope.gain.setValueAtTime(envConfig.sustain, releaseStart);
      envelope.gain.linearRampToValueAtTime(
        0,
        releaseStart + envConfig.release,
      );

      // Start and stop source
      sourceNode.start(now);
      const stopTime = releaseStart + envConfig.release + 0.1;
      sourceNode.stop(stopTime);

      // Clean up after sound finishes
      setTimeout(
        () => {
          try {
            sourceNode.disconnect();
            envelope.disconnect();
            if (filter && chainEnd !== envelope) {
              chainEnd.disconnect();
            }
          } catch (e) {
            // Already disconnected
          }
        },
        (stopTime - now) * 1000 + 100,
      );
    };

    // Sequencer - use mutable state object for proper tracking
    let sequencerInterval: ReturnType<typeof setInterval> | null = null;
    const sequenceState = {
      currentStep: 0,
      lastStepTime: 0,
      pattern: sequence ? sequence.pattern : null,
      rate: sequence ? sequence.rate : null,
    };

    // Create voice object early so functions can reference it
    const voice = {
      id,
      voiceGain,
      panner,
      outputNode: panner,
      isRunning: false,
      // These will be set below
      startSequence: null as (() => void) | null,
      stopSequence: null as (() => void) | null,
      trigger: triggerVoice,
      sequenceState,
      channel: targetChannel,
    };

    // Restore preserved state if available
    if (preservedState) {
      sequenceState.currentStep = preservedState.currentStep;
      sequenceState.lastStepTime = preservedState.lastStepTime;
    }

    const startSequence = () => {
      if (!sequence || !sequence.pattern) return;

      const { pattern, rate } = sequence;
      const stepDuration = 1000 / rate; // milliseconds per step

      // If no preserved state, sync to global clock
      if (sequenceState.lastStepTime === 0) {
        const clockTime = this.getClockTime();
        // Calculate which step we should be on based on global clock
        const totalSteps = Math.floor(clockTime / stepDuration);
        sequenceState.currentStep = totalSteps % pattern.length;
        sequenceState.lastStepTime = clockTime;
      }

      const scheduleSteps = () => {
        if (!this.isRunning) return;

        const currentTime = this.audioContext.currentTime;

        // Check if we need to trigger
        if (pattern[sequenceState.currentStep] === 1) {
          triggerVoice(currentTime);
        }

        sequenceState.currentStep =
          (sequenceState.currentStep + 1) % pattern.length;
        sequenceState.lastStepTime = this.getClockTime();
      };

      // Schedule at specified rate
      sequencerInterval = setInterval(scheduleSteps, stepDuration);
      this.activeSequences.push(sequencerInterval);
      voice.isRunning = true; // Mark as running
    };

    const stopSequence = () => {
      if (sequencerInterval) {
        clearInterval(sequencerInterval);
        const index = this.activeSequences.indexOf(sequencerInterval);
        if (index > -1) {
          this.activeSequences.splice(index, 1);
        }
        voice.isRunning = false; // Mark as stopped
      }
    };

    // Assign sequence functions to voice object
    voice.startSequence = startSequence;
    voice.stopSequence = stopSequence;
    voice.trigger = triggerVoice;

    this.activeVoices.set(id, voice);

    return voice;
  }

  /**
   * Update an existing voice's configuration (hot-swap)
   * @param {string} id - Voice ID
   * @param {Object} newConfig - New voice configuration
   */
  updateVoice(id, newConfig) {
    const existingVoice = this.activeVoices.get(id);
    if (!existingVoice) return;

    // Update trigger function with new config
    const { source, envelope: envConfig, filter } = newConfig;

    const triggerVoice = (triggerTime) => {
      const now = triggerTime || this.audioContext.currentTime;

      // Create fresh source for this trigger
      let sourceNode;
      if (source.type === "oscillator") {
        sourceNode = this.audioContext.createOscillator();
        sourceNode.frequency.value = source.freq;
        sourceNode.type = source.wave || "sine";
      } else if (source.type === "noise") {
        sourceNode = this.audioContext.createBufferSource();
        sourceNode.buffer = this.noiseBuffer;
        sourceNode.loop = false;
      }

      // Create envelope for this trigger
      const envelope = this.audioContext.createGain();
      envelope.gain.value = 0;

      // Build chain: source -> envelope -> filter? -> voiceGain
      sourceNode.connect(envelope);
      let chainEnd = envelope;

      if (filter) {
        const filterNode = this.createFilter(
          filter.type || "lowpass",
          filter.freq,
          filter.q || 1,
        );
        chainEnd.connect(filterNode);
        chainEnd = filterNode;
      }

      chainEnd.connect(existingVoice.voiceGain);

      // Schedule envelope
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(1, now + envConfig.attack);
      envelope.gain.linearRampToValueAtTime(
        envConfig.sustain,
        now + envConfig.attack + envConfig.decay,
      );
      const releaseStart = now + envConfig.attack + envConfig.decay + 0.01;
      envelope.gain.setValueAtTime(envConfig.sustain, releaseStart);
      envelope.gain.linearRampToValueAtTime(
        0,
        releaseStart + envConfig.release,
      );

      // Start and stop source
      sourceNode.start(now);
      const stopTime = releaseStart + envConfig.release + 0.1;
      sourceNode.stop(stopTime);

      // Clean up
      setTimeout(
        () => {
          try {
            sourceNode.disconnect();
            envelope.disconnect();
            if (filter && chainEnd !== envelope) {
              chainEnd.disconnect();
            }
          } catch (e) {
            // Already disconnected
          }
        },
        (stopTime - now) * 1000 + 100,
      );
    };

    // Update the trigger function
    existingVoice.trigger = triggerVoice;

  }

  /**
   * Queue a voice update to apply on the next beat
   * @param {string} id - Voice ID
   * @param {Object} config - New voice configuration
   */
  queueVoiceUpdate(id, config) {
    this.pendingVoiceUpdates.set(id, {
      source: config.source,
      envelope: config.envelope,
      filter: config.filter,
      gain: config.gain,
      pan: config.pan,
    });
  }

  /**
   * Stop all voice sequencers (for replace mode)
   */
  stopAllVoices() {
    this.activeVoices.forEach((voice) => {
      // Stop the sequencer
      if (voice.stopSequence) {
        voice.stopSequence();
      }
      // Disconnect voice nodes from master output
      if (voice.outputNode) {
        try {
          voice.outputNode.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }
    });
    this.activeVoices.clear();
  }

  /**
   * Fade out and stop all continuous audio sources
   * @param {number} fadeTime - Fade duration in seconds (default 0.3s)
   */
  fadeOutAllAudio(fadeTime = 0.3) {
    const now = this.audioContext.currentTime;

    // Fade out the master gain smoothly
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + fadeTime);

    // Schedule cleanup after fade completes
    setTimeout(
      () => {
        try {
          // Reset master gain to normal after fade
          this.masterGain.gain.setValueAtTime(0.7, now + fadeTime + 0.01);

          // Stop all active oscillators
          this.activeOscillators.forEach((osc) => {
            try {
              osc.stop();
            } catch (e) {
              // Already stopped
            }
          });
          this.activeOscillators = [];

          // Stop all active source nodes (noise, etc.)
          this.activeNodes.forEach((node) => {
            try {
              if (node && typeof node.stop === "function") {
                node.stop();
              }
              if (node && typeof node.disconnect === "function") {
                node.disconnect();
              }
            } catch (e) {
              // Already stopped
            }
          });
          this.activeNodes = [];
        } catch (e) {
          console.error("Error during audio cleanup:", e);
        }
      },
      fadeTime * 1000 + 50,
    );

  }

  /**
   * Stop all continuous audio sources (oscillators, noise)
   */
  stopAllAudioSources() {
    // Stop all active oscillators
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeOscillators = [];

    // Stop all active noise sources (they're in activeNodes, but we need to find them)
    this.activeNodes.forEach((node) => {
      try {
        if (node && typeof node.stop === "function") {
          // It's a source node (oscillator or buffer source)
          node.stop();
        }
        if (node && typeof node.disconnect === "function") {
          node.disconnect();
        }
      } catch (e) {
        // Already stopped or disconnected
      }
    });
    this.activeNodes = [];
  }

  /**
   * Get the current active channel (A or B)
   */
  getActiveChannel() {
    return this.activeChannel === "A" ? this.channelA : this.channelB;
  }

  /**
   * Get the standby channel (silent one)
   */
  getStandbyChannel() {
    return this.activeChannel === "A" ? this.channelB : this.channelA;
  }

  /**
   * Get the input node for a channel (before effects)
   */
  getChannelInput(channel) {
    return channel === this.channelA ? this.channelAInput : this.channelBInput;
  }

  /**
   * Set the input gain for a channel (pre-effects)
   */
  setChannelInputGain(channel, value) {
    const input = this.getChannelInput(channel);
    if (!input || !input.gain) return;
    const now = this.audioContext ? this.audioContext.currentTime : 0;
    input.gain.cancelScheduledValues(now);
    input.gain.setValueAtTime(value, now);
  }

  stopChannelVoices(channel) {
    const entries = Array.from(this.activeVoices.entries());
    entries.forEach(([id, voice]) => {
      if (voice.channel === channel) {
        voice.stopSequence?.();
        this.activeVoices.delete(id);
      }
    });
  }

  /**
   * Silence the engine immediately by muting and stopping all sources
   */
  silence() {
    if (!this.audioContext) {
      return;
    }
    const now = this.audioContext.currentTime;
    [this.channelAInput, this.channelBInput].forEach((input) => {
      if (!input?.gain) {
        return;
      }
      input.gain.cancelScheduledValues(now);
      input.gain.setValueAtTime(0, now);
    });
    [this.channelA, this.channelB].forEach((channel) => {
      if (!channel?.gain) {
        return;
      }
      channel.gain.cancelScheduledValues(now);
      channel.gain.setValueAtTime(0, now);
    });

    this.activeNodes.forEach((node) => {
      try {
        node?.stop?.();
      } catch {
        // ignore
      }
      try {
        node?.disconnect?.();
      } catch {
        // ignore
      }
    });
    this.activeNodes = [];

    this.resetPool(this.channelA);
    this.resetPool(this.channelB);

    this.activeVoices.forEach((voice) => {
      try {
        voice?.stop?.();
      } catch {
        // ignore
      }
    });
    this.activeVoices.clear();
    this.pendingVoiceUpdates.clear();
    this.pendingChannelSwap = false;
    this.cleanupSequencers(false);
  }

  /**
   * Collect runtime status useful for debugging audio issues
   */
  getDebugStatus() {
    const ctx = this.audioContext;
    const countActive = (list) =>
      Array.isArray(list)
        ? list.reduce((sum, item) => sum + (item?.active ? 1 : 0), 0)
        : 0;
    const channelStats = (channel, pool) => ({
      gain: channel?.gain?.value ?? 0,
      activeOscillators: countActive(pool?.oscillators),
      activeNoise: countActive(pool?.noise),
    });
    return {
      contextState: ctx ? ctx.state : "inactive",
      sampleRate: ctx ? ctx.sampleRate : 0,
      currentTime: ctx ? ctx.currentTime : 0,
      isRunning: this.isRunning,
      useWorklet: this.useWorklet,
      workletReady: this.workletReady,
      masterGain: this.masterGain?.gain?.value ?? 0,
      channelA: channelStats(this.channelA, this.poolA),
      channelB: channelStats(this.channelB, this.poolB),
      activeChannel: this.activeChannel,
      activeVoices: this.activeVoices.size,
      pendingVoiceUpdates: this.pendingVoiceUpdates.size,
      pendingChannelSwap: this.pendingChannelSwap,
      tailHoldTime: this.tailHoldTime,
      totalNodes: this.activeNodes.length,
    };
  }

  /**
   * Route a channel input through an effects chain (or direct)
   */
  routeChannelThroughEffects(channel, effectsChain) {
    const input = this.getChannelInput(channel);
    if (!input || !channel) return;

    const isChannelA = channel === this.channelA;
    const prev = isChannelA ? this.channelAEffects : this.channelBEffects;

    // Disconnect input from any previous routing
    try {
      input.disconnect();
    } catch (e) {
      // ignore
    }

    // Disconnect previous effects nodes
    if (prev && prev.length) {
      prev.forEach((item) => {
        try {
          item.output?.disconnect();
        } catch (e) {
          // ignore
        }
        try {
          item.node?.disconnect();
        } catch (e) {
          // ignore
        }
      });
    }

    if (!effectsChain || effectsChain.length === 0) {
      input.connect(channel);
      if (isChannelA) this.channelAEffects = null;
      else this.channelBEffects = null;
      return;
    }

    // Connect input -> first effect
    input.connect(effectsChain[0].node || effectsChain[0].output);

    // Chain effects in order
    for (let i = 0; i < effectsChain.length - 1; i++) {
      const current = effectsChain[i];
      const next = effectsChain[i + 1];
      try {
        (current.output || current.node).connect(next.node || next.output);
      } catch (e) {
        // ignore
      }
    }

    // Last effect -> channel output
    const last = effectsChain[effectsChain.length - 1];
    (last.output || last.node).connect(channel);

    if (isChannelA) this.channelAEffects = effectsChain;
    else this.channelBEffects = effectsChain;
  }

  /**
   * Send a JSON patch to the worklet for a specific channel
   */
  sendPatchToWorklet(channel, patch) {
    if (!this.useWorklet || !this.workletReady) {
      return;
    }
    const target = channel === this.channelA ? this.workletA : this.workletB;
    if (target && target.port) {
      target.port.postMessage({ type: "setPatch", patch });
    }

  }
  /**
   * Queue a channel swap for the next beat
   */
  queueChannelSwap() {
    // If a swap is already pending, perform it immediately before queuing a new one
    if (this.pendingChannelSwap) {
      this.performChannelSwap(0.05);
    }

    this.pendingChannelSwap = true;

    // If no voices are playing, schedule the swap immediately for next beat
    // (normally voices trigger the swap on their beat)
    if (this.activeVoices.size === 0) {
      // Schedule swap ~250ms for a reasonable beat time
      const self = this;
      setTimeout(() => {
        if (self.pendingChannelSwap) {
          self.performChannelSwap(0.05);
        }
      }, 250);
    }
  }

  /**
   * Perform the channel swap (called on beat trigger)
   * @param {number} fadeTime - Crossfade duration in seconds
   */
  performChannelSwap(fadeTime = 0.1) {
    if (!this.pendingChannelSwap) {
      return;
    }

    const now = this.audioContext.currentTime;

    // Get current channels BEFORE swapping
    const previousActiveChannel = this.getActiveChannel();
    const newActiveChannel = this.getStandbyChannel();


    // Crossfade: equal-power curve
    const steps = 128;
    const fadeOut = new Float32Array(steps);
    const fadeIn = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      fadeOut[i] = Math.cos(t * Math.PI * 0.5);
      fadeIn[i] = Math.sin(t * Math.PI * 0.5);
    }

    previousActiveChannel.gain.cancelScheduledValues(now);
    newActiveChannel.gain.cancelScheduledValues(now);
    previousActiveChannel.gain.setValueAtTime(
      previousActiveChannel.gain.value,
      now,
    );
    newActiveChannel.gain.setValueAtTime(newActiveChannel.gain.value, now);
    previousActiveChannel.gain.setValueCurveAtTime(fadeOut, now, fadeTime);
    newActiveChannel.gain.setValueCurveAtTime(fadeIn, now, fadeTime);

    // Swap active channel AFTER setting up the fades
    this.activeChannel = this.activeChannel === "A" ? "B" : "A";
    this.pendingChannelSwap = false;

    // Release pooled sources on the previous active channel after fade completes
    const releaseDelayMs = Math.max(0, (fadeTime + this.tailHoldTime) * 1000);
    setTimeout(() => {
      this.resetPool(previousActiveChannel);
      this.stopChannelVoices(previousActiveChannel);
    }, releaseDelayMs);
  }

  /**
   * Create a gentle soft-clipper waveshaper
   */
  createSoftClipper() {
    const shaper = this.audioContext.createWaveShaper();
    const samples = 1024;
    const curve = new Float32Array(samples);
    const k = 2.5;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(k * x);
    }
    shaper.curve = curve;
    shaper.oversample = "4x";
    return shaper;
  }

  /**
   * Track sources for a channel (for cleanup purposes) - DEPRECATED with pooling
   */
  setChannelSources(channel, sources) {
    // No longer needed with object pooling
  }

  /**
   * Get sources for a channel - DEPRECATED with pooling
   */
  getChannelSources(channel) {
    // No longer needed with object pooling
    return [];
  }

  /**
   * Clear sources for a channel - DEPRECATED with pooling
   */
  clearChannelSources(channel) {
    // No longer needed with object pooling
  }

  /**
   * Stop and cleanup all sequencers
   * @param {boolean} preserveState - Keep voice state for rhythm preservation
   */
  cleanupSequencers(preserveState = false) {
    this.activeSequences.forEach((interval) => clearInterval(interval));
    this.activeSequences = [];

    if (!preserveState) {
      this.activeVoices.clear();
    }
    // If preserveState=true, keep activeVoices map for next build
  }
}

// Create singleton instance
const audioEngine = new AudioEngine();

export default audioEngine;
