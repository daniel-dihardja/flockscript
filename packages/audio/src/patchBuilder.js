/**
 * Patch Builder - Interprets JSON patches and builds audio graphs
 */

import audioEngine from "./audioEngine.js";

class PatchBuilder {
  constructor() {
    this.nodes = new Map(); // Store created nodes by ID
    this.modulators = [];
  }

  /**
   * Clear all stale sources from a channel before rebuilding
   * (deprecated with pooling, but kept for reference)
   */
  clearChannelSources(channel) {
    // With object pooling, we use resetPool instead
    console.log("[Cleanup] Using resetPool instead");
  }

  /**
   * Parse and build audio patch from JSON
   * @param {Object} patchData - JSON patch definition
   */
  build(patchData) {
    console.log("[PatchBuilder] build() called with patchData:", patchData);

    // Validate audioEngine
    if (!audioEngine || !audioEngine.isRunning) {
      throw new Error(
        "[PatchBuilder] Audio engine not initialized or not running!",
      );
    }

    if (!audioEngine.channelA || !audioEngine.channelB) {
      throw new Error("[PatchBuilder] Audio channels not initialized!");
    }

    if (!audioEngine.poolA || !audioEngine.poolB) {
      throw new Error("[PatchBuilder] Pools not initialized!");
    }

    console.log(
      `[PatchBuilder] AudioEngine state: poolA.oscillators=${audioEngine.poolA.oscillators.length}, poolB.oscillators=${audioEngine.poolB.oscillators.length}`,
    );

    // Store master tempo for voice building
    this.masterTempo = patchData.tempo || 120;
    this.stepsPerBeat = patchData.stepsPerBeat || 4;
    // Always replace: build on standby channel and swap on beat
    this.targetChannel = audioEngine.getStandbyChannel();
    audioEngine.resetPool(this.targetChannel);
    audioEngine.queueChannelSwap();
    console.log("[Replace Mode] Building on standby channel, swap queued");

    if (!this.targetChannel) {
      throw new Error("[PatchBuilder] Could not determine target channel!");
    }

    console.log(
      `[PatchBuilder] Target channel set, starting to build nodes...`,
    );

    if (audioEngine.useWorklet && audioEngine.workletReady) {
      audioEngine.setChannelInputGain(this.targetChannel, 1.0);
      audioEngine.sendPatchToWorklet(this.targetChannel, patchData);
      // Ensure direct routing when using worklet (effects are handled internally)
      audioEngine.routeChannelThroughEffects(this.targetChannel, []);
      console.log("[Worklet] Patch sent to worklet node");
      return;
    }

    audioEngine.setChannelInputGain(this.targetChannel, 1.0);

    this.nodes.clear();
    this.modulators = [];

    // Build oscillators (continuous sounds)
    if (patchData.oscillators) {
      patchData.oscillators.forEach((osc) => this.buildOscillator(osc));
    }

    // Build noise sources (continuous)
    if (patchData.noise) {
      patchData.noise.forEach((n) => this.buildNoise(n));
    }

    // Build or hot-swap voices (keep sequencers running)
    if (patchData.voices) {
      patchData.voices.forEach((voice) => this.buildVoice(voice));
    }

    // Build effects chain
    if (patchData.effects) {
      this.buildEffectsChain(patchData.effects);
    }

    // Build modulators (for continuous sounds)
    if (patchData.modulators) {
      patchData.modulators.forEach((mod) => this.buildModulator(mod));
    }

    // Apply modulation routings
    if (patchData.routing) {
      this.applyRouting(patchData.routing);
    }

    // Connect everything to the target channel
    this.connectToMaster();

    // Start sequencers for voices (or skip if already running)
    this.startSequencers();
  }

  /**
   * Build an oscillator (from pool)
   */
  buildOscillator(config) {
    const {
      id = `osc_${this.nodes.size}`,
      freq = 440,
      gain = 0.3,
      type = "sine",
      detune = 0,
      pan = 0,
    } = config;

    console.log("[PatchBuilder] buildOscillator called with:", config);

    // Get an oscillator from the pool
    const pooledItem = audioEngine.getPooledOscillator(this.targetChannel);
    if (!pooledItem) {
      console.error("[PatchBuilder] Failed to get pooled oscillator");
      return;
    }

    console.log("[PatchBuilder] Got pooled item:", pooledItem);
    console.log("[PatchBuilder] pooledItem keys:", Object.keys(pooledItem));
    console.log("[PatchBuilder] pooledItem.gain:", pooledItem.gain);
    const { osc, gain: oscGain, panner } = pooledItem;

    if (!osc) {
      console.error("[PatchBuilder] osc is undefined! pooledItem:", pooledItem);
      return;
    }

    if (!oscGain) {
      console.error(
        "[PatchBuilder] oscGain is undefined! pooledItem:",
        pooledItem,
      );
      return;
    }

    if (!panner) {
      console.error(
        "[PatchBuilder] panner is undefined! pooledItem:",
        pooledItem,
      );
      return;
    }

    console.log("[PatchBuilder] After destructuring - osc:", osc);
    console.log("[PatchBuilder] After destructuring - oscGain:", oscGain);
    console.log(
      "[PatchBuilder] After destructuring - oscGain.gain:",
      oscGain.gain,
    );
    console.log("[PatchBuilder] After destructuring - panner:", panner);

    // Update oscillator parameters
    osc.frequency.setValueAtTime(freq, audioEngine.getCurrentTime());
    osc.type = type;
    if (detune !== 0) {
      osc.detune.value = detune;
    }

    // Update gain
    if (!oscGain || !oscGain.gain) {
      console.error(
        "[PatchBuilder] CRITICAL: oscGain or oscGain.gain is invalid!",
        {
          oscGain,
          hasGain: oscGain ? oscGain.gain : "undefined",
        },
      );
      throw new Error(
        `oscGain.gain is undefined. oscGain type: ${typeof oscGain}`,
      );
    }
    oscGain.gain.setValueAtTime(gain, audioEngine.getCurrentTime());

    // Update pan
    if (!panner || !panner.pan) {
      console.error(
        "[PatchBuilder] CRITICAL: panner or panner.pan is invalid!",
        {
          panner,
          hasPan: panner ? panner.pan : "undefined",
        },
      );
      throw new Error(`panner.pan is undefined. panner type: ${typeof panner}`);
    }
    panner.pan.setValueAtTime(pan, audioEngine.getCurrentTime());

    this.nodes.set(id, {
      type: "oscillator",
      pooledItem,
      osc,
      gain: oscGain,
      panner,
      output: panner,
    });

    return this.nodes.get(id);
  }

  /**
   * Build a noise source (from pool)
   */
  buildNoise(config) {
    const { id = `noise_${this.nodes.size}`, gain = 0.3, pan = 0 } = config;

    console.log("[PatchBuilder] buildNoise called with:", config);

    // Get a noise source from the pool
    const pooledItem = audioEngine.getPooledNoise(this.targetChannel);
    if (!pooledItem) {
      console.error("[PatchBuilder] Failed to get pooled noise");
      return;
    }

    console.log("[PatchBuilder] Got pooled noise item:", pooledItem);
    console.log("[PatchBuilder] pooledItem keys:", Object.keys(pooledItem));
    console.log("[PatchBuilder] pooledItem.gain:", pooledItem.gain);
    const { noise, gain: noiseGain, panner } = pooledItem;

    if (!noise) {
      console.error(
        "[PatchBuilder] noise is undefined! pooledItem:",
        pooledItem,
      );
      return;
    }

    if (!noiseGain) {
      console.error(
        "[PatchBuilder] noiseGain is undefined! pooledItem:",
        pooledItem,
      );
      return;
    }

    if (!panner) {
      console.error(
        "[PatchBuilder] panner is undefined! pooledItem:",
        pooledItem,
      );
      return;
    }

    console.log("[PatchBuilder] After destructuring - noise:", noise);
    console.log("[PatchBuilder] After destructuring - noiseGain:", noiseGain);
    console.log(
      "[PatchBuilder] After destructuring - noiseGain.gain:",
      noiseGain.gain,
    );
    console.log("[PatchBuilder] After destructuring - panner:", panner);

    // Update gain
    if (!noiseGain || !noiseGain.gain) {
      console.error(
        "[PatchBuilder] CRITICAL: noiseGain or noiseGain.gain is invalid!",
        {
          noiseGain,
          hasGain: noiseGain ? noiseGain.gain : "undefined",
        },
      );
      throw new Error(
        `noiseGain.gain is undefined. noiseGain type: ${typeof noiseGain}`,
      );
    }
    noiseGain.gain.setValueAtTime(gain, audioEngine.getCurrentTime());

    // Update pan
    if (!panner || !panner.pan) {
      console.error(
        "[PatchBuilder] CRITICAL: panner or panner.pan is invalid!",
        {
          panner,
          hasPan: panner ? panner.pan : "undefined",
        },
      );
      throw new Error(`panner.pan is undefined. panner type: ${typeof panner}`);
    }
    panner.pan.setValueAtTime(pan, audioEngine.getCurrentTime());

    this.nodes.set(id, {
      type: "noise",
      pooledItem,
      source: noise,
      gain: noiseGain,
      panner,
      output: panner,
    });

    return this.nodes.get(id);
  }

  /**
   * Build a voice (sequenced/triggered sound) - supports hot-swap on next beat
   */
  buildVoice(config) {
    // Apply master tempo if sequence uses it
    let voiceConfig = { ...config };
    if (voiceConfig.sequence && this.masterTempo) {
      // Calculate rate from master tempo
      // rate = (BPM / 60) * stepsPerBeat
      voiceConfig.sequence = {
        ...voiceConfig.sequence,
        rate: (this.masterTempo / 60) * this.stepsPerBeat,
      };
    }

    // Check if voice already exists (hot-swap mode)
    const existingVoice = audioEngine.activeVoices.get(config.id);
    if (existingVoice) {
      // Queue update for next beat instead of updating immediately
      audioEngine.queueVoiceUpdate(config.id, voiceConfig);
      this.nodes.set(config.id, {
        type: "voice",
        voice: existingVoice,
        output: existingVoice.outputNode,
      });
    } else {
      // Create new voice
      const voice = audioEngine.createVoice(voiceConfig);
      this.nodes.set(config.id, {
        type: "voice",
        voice,
        output: voice.outputNode,
      });
    }

    return this.nodes.get(config.id);
  }

  /**
   * Build effects chain
   */
  buildEffectsChain(effects) {
    const chain = [];

    effects.forEach((effect) => {
      let node;

      switch (effect.type) {
        case "filter":
          node = audioEngine.createFilter(
            effect.filterType || "lowpass",
            effect.freq || 1000,
            effect.q || 1,
          );
          chain.push({ type: "filter", node, output: node });
          break;

        case "delay":
          const { delay, feedbackGain } = audioEngine.createDelay(
            effect.time || 0.5,
            effect.feedback || 0.5,
          );
          chain.push({
            type: "delay",
            node: delay,
            feedbackGain,
            output: delay,
          });
          break;

        case "distortion":
          node = audioEngine.createDistortion(effect.amount || 50);
          chain.push({ type: "distortion", node, output: node });
          break;

        case "reverb":
          node = audioEngine.createReverb(
            effect.duration || 2,
            effect.decay || 2,
            effect.reverse || false,
          );
          chain.push({ type: "reverb", node, output: node });
          break;

        case "gain":
          node = audioEngine.createGain(effect.value || 1.0);
          chain.push({ type: "gain", node, output: node });
          break;
      }

      // Store effect with ID for modulation routing
      if (effect.id) {
        this.nodes.set(effect.id, chain[chain.length - 1]);
      }
    });

    // Store the effects chain
    this.nodes.set("__effects_chain__", chain);
  }

  /**
   * Build a modulator
   */
  buildModulator(config) {
    const { type, id = `mod_${this.modulators.length}` } = config;
    let modulator;

    switch (type) {
      case "lfo":
        const { lfo, gain } = audioEngine.createLFO(
          config.rate || 1,
          config.depth || 100,
          config.wave || "sine",
        );
        lfo.start(audioEngine.getCurrentTime());
        modulator = { type: "lfo", lfo, gain, output: gain };
        break;

      case "sampleHold":
        const sh = audioEngine.createSampleHold(
          config.rate || 8,
          config.min || 100,
          config.max || 2000,
        );
        sh.source.start(audioEngine.getCurrentTime());
        modulator = {
          type: "sampleHold",
          source: sh.source,
          output: sh.source,
          stop: sh.stop,
        };
        break;

      case "chaos":
        const ch = audioEngine.createChaos(
          config.rate || 10,
          config.center || 500,
          config.range || 500,
          config.step || 0.2,
        );
        ch.source.start(audioEngine.getCurrentTime());
        modulator = {
          type: "chaos",
          source: ch.source,
          output: ch.source,
          stop: ch.stop,
        };
        break;
    }

    if (modulator) {
      this.nodes.set(id, modulator);
      this.modulators.push(modulator);
    }
  }

  /**
   * Apply modulation routing
   */
  applyRouting(routings) {
    routings.forEach((route) => {
      const source = this.nodes.get(route.from);
      const target = this.nodes.get(route.to);

      if (!source || !target) {
        console.warn(`Routing failed: ${route.from} -> ${route.to}`);
        return;
      }

      // Get the parameter to modulate
      const param = this.resolveParameter(target, route.param);

      if (param) {
        source.output.connect(param);
      }
    });
  }

  /**
   * Resolve audio parameter from string path
   */
  resolveParameter(node, paramPath) {
    const parts = paramPath.split(".");

    // Oscillator parameters
    if (parts[0] === "frequency" && node.osc) {
      return node.osc.frequency;
    }
    if (parts[0] === "detune" && node.osc) {
      return node.osc.detune;
    }

    // Gain parameter
    if (parts[0] === "gain") {
      return node.gain ? node.gain.gain : null;
    }

    // Pan parameter
    if (parts[0] === "pan") {
      return node.panner ? node.panner.pan : null;
    }

    // Filter parameters
    if (node.type === "filter" && node.node) {
      if (parts[0] === "frequency" || parts[0] === "freq") {
        return node.node.frequency;
      }
      if (parts[0] === "q" || parts[0] === "Q") {
        return node.node.Q;
      }
    }

    // Delay parameters
    if (node.type === "delay") {
      if (parts[0] === "time" || parts[0] === "delayTime") {
        return node.node.delayTime;
      }
      if (parts[0] === "feedback" && node.feedbackGain) {
        return node.feedbackGain.gain;
      }
    }

    return null;
  }

  /**
   * Connect all source nodes to master through effects chain
   */
  connectToMaster() {
    const effectsChain = this.nodes.get("__effects_chain__") || [];
    audioEngine.routeChannelThroughEffects(this.targetChannel, effectsChain);
    console.log(
      `[ConnectToMaster] Routed channel through ${effectsChain.length} effects`,
    );
  }

  /**
   * Start all voice sequencers (skip if already running)
   */
  startSequencers() {
    const voices = Array.from(this.nodes.values()).filter(
      (node) => node.type === "voice",
    );
    voices.forEach((node) => {
      // Check if sequencer is already running
      if (node.voice.isRunning) {
        console.log(
          `[Hot-Swap] Voice ${node.voice.id} sequencer already running`,
        );
        return; // Skip, keep running
      }

      if (node.voice.startSequence) {
        node.voice.startSequence();
      }
    });
  }
}

export default PatchBuilder;
