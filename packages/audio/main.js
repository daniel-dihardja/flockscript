/**
 * Main entry point - UI controls and live coding integration
 */

import audioEngine from "./audioEngine.js";
import PatchBuilder from "./patchBuilder.js";
import { createEditor, defaultPatch } from "./editor.js";
let patchIndex = [];

// DOM elements
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const runBtn = document.getElementById("runBtn");
const clearBtn = document.getElementById("clearBtn");
const validateBtn = document.getElementById("validateBtn");
const silenceBtn = document.getElementById("silenceBtn");
const stressBtn = document.getElementById("stressBtn");
const workletToggle = document.getElementById("workletToggle");
const patchCategory = document.getElementById("patchCategory");
const patchSelector = document.getElementById("patchSelector");
const editorWrapper = document.getElementById("editorWrapper");
const statusDiv = document.getElementById("status");
const outputDiv = document.getElementById("output");
const validationStatus = document.getElementById("validationStatus");

// Debug info elements
const channelAStatus = document.getElementById("channelAStatus");
const channelBStatus = document.getElementById("channelBStatus");
const activeChannelStatus = document.getElementById("activeChannelStatus");
const modeStatus = null;

// CodeMirror editor instance
let editor = null;

// Current audio chain (for live coding API)
let currentChain = null;
let patchBuilder = new PatchBuilder();
let autoStartAttempted = false;
let selectedCategory = "All";
let stressTimer = null;
let stressEndTime = 0;

/**
 * Update audio readiness hint in the editor status
 */
function updateAudioHint(isReady) {
  const baseLabel = validationStatus.textContent.includes("JSON")
    ? validationStatus.textContent.replace(/^Audio:.*\|\s*/i, "")
    : "JSON Editor";
  const audioLabel = isReady ? "Audio: Ready" : "Audio: Click Start";
  validationStatus.textContent = `${audioLabel} | ${baseLabel}`;
}

/**
 * Update debug info display
 */
function updateDebugInfo() {
  const channelA = audioEngine.channelA;
  const channelB = audioEngine.channelB;
  const activeCh = audioEngine.activeChannel;

  // If audio engine not initialized yet, show placeholder
  if (!channelA || !channelB) {
    channelAStatus.textContent = "- (not initialized)";
    channelBStatus.textContent = "- (not initialized)";
    activeChannelStatus.textContent = `Channel ${activeCh}`;
    if (modeStatus) {
      modeStatus.textContent = "Replace (swap)";
    }
    return;
  }

  // Count active sources in pools
  const activeOscA = audioEngine.poolA.oscillators.filter(
    (o) => o.active,
  ).length;
  const activeOscB = audioEngine.poolB.oscillators.filter(
    (o) => o.active,
  ).length;
  const activeNoiseA = audioEngine.poolA.noise.filter((n) => n.active).length;
  const activeNoiseB = audioEngine.poolB.noise.filter((n) => n.active).length;

  const sourceCountA = activeOscA + activeNoiseA;
  const sourceCountB = activeOscB + activeNoiseB;

  channelAStatus.textContent = `${activeOscA}osc + ${activeNoiseA}noise (gain: ${channelA.gain.value.toFixed(2)})`;
  channelBStatus.textContent = `${activeOscB}osc + ${activeNoiseB}noise (gain: ${channelB.gain.value.toFixed(2)})`;
  activeChannelStatus.textContent = `Channel ${activeCh}`;
  if (modeStatus) {
    modeStatus.textContent = "Replace (swap)";
  }
}

/**
 * Populate patch selector dropdown
 */
function populatePatchSelector() {
  patchSelector.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a patch...";
  patchSelector.appendChild(placeholder);

  const filtered =
    selectedCategory === "All"
      ? patchIndex
      : patchIndex.filter((entry) => entry.category === selectedCategory);

  filtered.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.name;
    option.textContent = entry.name;
    patchSelector.appendChild(option);
  });
}

function populateCategorySelector() {
  if (!patchCategory) return;
  patchCategory.innerHTML = "";
  const optionAll = document.createElement("option");
  optionAll.value = "All";
  optionAll.textContent = "All categories";
  patchCategory.appendChild(optionAll);

  const categories = Array.from(
    new Set(patchIndex.map((entry) => entry.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    patchCategory.appendChild(option);
  });
}

function getPatchEntry(name) {
  return patchIndex.find((entry) => entry.name === name);
}

async function loadPatchIndex() {
  try {
    const res = await fetch("./patches/manifest.json");
    if (!res.ok) {
      throw new Error(`Failed to load patch manifest (${res.status})`);
    }
    const data = await res.json();
    patchIndex = Array.isArray(data.patches) ? data.patches : [];
    populateCategorySelector();
    populatePatchSelector();
  } catch (error) {
    console.error("Failed to load patch manifest:", error);
    showOutput("Failed to load patch list", true);
  }
}

/**
 * Load selected patch into editor
 */
async function loadPatch(patchName) {
  const entry = getPatchEntry(patchName);
  if (!patchName || !entry) {
    return;
  }

  try {
    const res = await fetch(entry.file);
    if (!res.ok) {
      throw new Error(`Failed to load patch (${res.status})`);
    }
    const patchData = await res.json();
    const patchJSON = JSON.stringify(patchData, null, 2);
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: patchJSON },
    });

    updateValidationStatus("valid", `✓ Loaded: ${patchName}`);
    showOutput(`Loaded patch: ${patchName}`);
  } catch (error) {
    console.error("Failed to load patch:", error);
    showOutput(`Failed to load patch: ${patchName}`, true);
  }
}

function applyPatchData(patchData, label = "Patch") {
  try {
    patchBuilder = new PatchBuilder();
    patchBuilder.build(patchData);
    updateDebugInfo();
    showOutput(`✓ ${label} applied (synced to next beat!)`);
  } catch (buildError) {
    console.error("[applyPatchData] Patch build error:", buildError.message);
    console.error("[applyPatchData] Full error:", buildError);
    showOutput(`Build Error: ${buildError.message}`, true);
  }
}

async function applySilencePatch() {
  if (!audioEngine.isRunning) {
    showOutput("Start audio first!", true);
    return;
  }

  const silencePatch = {
    oscillators: [],
    noise: [],
    modulators: [],
    routing: [],
    effects: [],
    voices: [],
  };

  applyPatchData(silencePatch, "Silence");
}

function startStressTest(durationMs = 5000) {
  if (stressTimer) {
    return;
  }
  stressEndTime = performance.now() + durationMs;
  stressTimer = setInterval(() => {
    const payload = [];
    for (let i = 0; i < 2000; i++) {
      payload.push({ id: i, value: Math.random() * 1000 });
    }
    const json = JSON.stringify(payload);
    JSON.parse(json);

    if (performance.now() >= stressEndTime) {
      stopStressTest();
    }
  }, 50);
  showOutput("Stress test running (5s)...");
}

function stopStressTest() {
  if (stressTimer) {
    clearInterval(stressTimer);
    stressTimer = null;
    showOutput("Stress test complete");
  }
}

/**
 * Update status display
 */
function updateStatus(message, isError = false) {
  statusDiv.textContent = `Status: ${message}`;
  statusDiv.style.color = isError ? "#ff0000" : "#00ff00";
  updateAudioHint(audioEngine.isRunning);
}

/**
 * Show output message
 */
function showOutput(message, isError = false) {
  outputDiv.textContent = message;
  outputDiv.style.color = isError ? "#ff0000" : "#ffaa00";
  outputDiv.classList.add("visible");

  setTimeout(() => {
    outputDiv.classList.remove("visible");
  }, 3000);
}

/**
 * Start audio context
 */
async function startAudio() {
  try {
    await audioEngine.init();
    await audioEngine.resume();

    if (
      audioEngine.audioContext &&
      audioEngine.audioContext.state !== "running"
    ) {
      throw new Error(
        `AudioContext state is ${audioEngine.audioContext.state}`,
      );
    }
    updateStatus("Running");

    startBtn.disabled = true;
    stopBtn.disabled = false;
    runBtn.disabled = false;

    updateAudioHint(true);

    showOutput("Audio engine started!");
  } catch (error) {
    updateStatus("Error starting audio", true);
    console.error("Audio init error:", error);
    showOutput(`Error: ${error.message}`, true);
    updateAudioHint(false);
  }
}

/**
 * Stop audio context
 */
function stopAudio() {
  audioEngine.stop();
  updateStatus("Stopped");

  startBtn.disabled = false;
  stopBtn.disabled = true;
  runBtn.disabled = true;
  updateAudioHint(false);
}

/**
 * Live coding API - Available functions for user scripts
 */
const liveCodingAPI = {
  /**
   * Create an oscillator
   * @param {number} freq - Frequency in Hz
   * @param {number} gain - Gain level (0-1)
   * @param {string} type - Oscillator type (sine, square, sawtooth, triangle)
   */
  osc: (freq = 440, gain = 0.3, type = "sine") => {
    const osc = audioEngine.createOscillator(freq, type);
    const oscGain = audioEngine.createGain(gain);

    osc.connect(oscGain);

    if (!currentChain) {
      currentChain = oscGain;
    } else {
      oscGain.connect(currentChain);
      currentChain = oscGain;
    }

    osc.start(audioEngine.getCurrentTime());

    return { osc, gain: oscGain };
  },

  /**
   * Create white noise
   * @param {number} gain - Gain level (0-1)
   */
  noise: (gain = 0.3) => {
    const noise = audioEngine.createNoise();
    const noiseGain = audioEngine.createGain(gain);

    noise.connect(noiseGain);

    if (!currentChain) {
      currentChain = noiseGain;
    } else {
      noiseGain.connect(currentChain);
      currentChain = noiseGain;
    }

    noise.start(audioEngine.getCurrentTime());

    return { noise, gain: noiseGain };
  },

  /**
   * Add a filter to the chain
   * @param {string} type - Filter type (lowpass, highpass, bandpass, notch)
   * @param {number} freq - Cutoff frequency
   * @param {number} q - Q factor
   */
  filter: (type = "lowpass", freq = 1000, q = 1) => {
    const filter = audioEngine.createFilter(type, freq, q);

    if (currentChain) {
      currentChain.connect(filter);
      currentChain = filter;
    }

    return filter;
  },

  /**
   * Add delay effect
   * @param {number} time - Delay time in seconds
   * @param {number} feedback - Feedback amount (0-1)
   */
  delay: (time = 0.5, feedback = 0.5) => {
    const { delay, feedbackGain } = audioEngine.createDelay(time, feedback);

    if (currentChain) {
      currentChain.connect(delay);
      currentChain = delay;
    }

    return { delay, feedbackGain };
  },

  /**
   * Add distortion effect
   * @param {number} amount - Distortion amount (0-400)
   */
  distortion: (amount = 50) => {
    const dist = audioEngine.createDistortion(amount);

    if (currentChain) {
      currentChain.connect(dist);
      currentChain = dist;
    }

    return dist;
  },

  /**
   * Create LFO modulation
   * @param {string} target - What to modulate ('frequency', 'gain', 'filter')
   * @param {number} rate - LFO speed in Hz
   * @param {number} depth - Modulation amount
   * @param {string} wave - LFO waveform (sine, square, sawtooth, triangle)
   * @returns {Object} LFO object with controls
   */
  lfo: (target = "frequency", rate = 2, depth = 100, wave = "sine") => {
    const { lfo, gain } = audioEngine.createLFO(rate, depth, wave);
    lfo.start(audioEngine.getCurrentTime());

    return {
      lfo,
      gain,
      connect: (param) => gain.connect(param),
      rate: (newRate) =>
        lfo.frequency.setValueAtTime(newRate, audioEngine.getCurrentTime()),
      depth: (newDepth) =>
        gain.gain.setValueAtTime(newDepth, audioEngine.getCurrentTime()),
    };
  },

  /**
   * Create sample & hold modulation (stepped random)
   * @param {number} rate - Steps per second
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {Object} Sample & hold modulator
   */
  sampleHold: (rate = 8, min = 100, max = 2000) => {
    const sh = audioEngine.createSampleHold(rate, min, max);
    sh.source.start(audioEngine.getCurrentTime());

    return {
      source: sh.source,
      connect: (param) => sh.source.connect(param),
      stop: sh.stop,
    };
  },

  /**
   * Create chaotic modulation (random walk)
   * @param {number} rate - Update rate in Hz
   * @param {number} center - Center value
   * @param {number} range - Deviation range
   * @param {number} step - Step size (0-1)
   * @returns {Object} Chaos modulator
   */
  chaos: (rate = 10, center = 500, range = 500, step = 0.2) => {
    const ch = audioEngine.createChaos(rate, center, range, step);
    ch.source.start(audioEngine.getCurrentTime());

    return {
      source: ch.source,
      connect: (param) => ch.source.connect(param),
      stop: ch.stop,
    };
  },
};

/**
 * Execute user code safely
 */
async function runUserCode() {
  if (!audioEngine.isRunning) {
    showOutput("Start audio first!", true);
    return;
  }

  const code = editor.state.doc.toString().trim();

  if (!code) {
    showOutput("Editor is empty!", true);
    return;
  }

  try {
    // For hot-swap with voices: DON'T call cleanup at all
    // Voices stay connected and keep running with their sequencers
    // The audio graph persists between patch updates
    currentChain = null;

    // Try to parse as JSON first
    let patchData;
    try {
      patchData = JSON.parse(code);
      console.log("[runUserCode] JSON parsed successfully");
    } catch (parseError) {
      console.error("[runUserCode] JSON parse error:", parseError.message);
      console.error("[runUserCode] Code preview:", code.substring(0, 100));

      // Not JSON, try JavaScript execution
      try {
        const userFunction = new Function(
          "osc",
          "noise",
          "filter",
          "delay",
          "distortion",
          "lfo",
          "sampleHold",
          "chaos",
          code,
        );

        // Execute user code
        userFunction(
          liveCodingAPI.osc,
          liveCodingAPI.noise,
          liveCodingAPI.filter,
          liveCodingAPI.delay,
          liveCodingAPI.distortion,
          liveCodingAPI.lfo,
          liveCodingAPI.sampleHold,
          liveCodingAPI.chaos,
        );

        // Connect final chain to master
        if (currentChain) {
          currentChain.connect(audioEngine.masterGain);
        }

        showOutput("✓ Code executed successfully!");
      } catch (jsError) {
        console.error("[runUserCode] JavaScript execution error:", jsError);
        showOutput(`JS Error: ${jsError.message}`, true);
      }
      return;
    }

    // JSON parsed successfully, now build the patch
    try {
      // JSON mode - build patch from JSON (voice updates get queued for next beat)
      patchBuilder = new PatchBuilder();
      patchBuilder.build(patchData);

      // Update debug info
      updateDebugInfo();

      showOutput("✓ Patch updated (synced to next beat!)");
    } catch (buildError) {
      console.error("[runUserCode] Patch build error:", buildError.message);
      console.error("[runUserCode] Full error:", buildError);
      showOutput(`Build Error: ${buildError.message}`, true);
    }
  } catch (error) {
    console.error("Execution error:", error);
    showOutput(`Error: ${error.message}`, true);
    updateStatus("Execution error", true);
  }
}

/**
 * Clear editor
 */
function clearEditor() {
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: "" },
  });
  editor.focus();
  updateValidationStatus();
}

/**
 * Validate JSON in editor
 */
function validateJSON() {
  const code = editor.state.doc.toString().trim();

  try {
    JSON.parse(code);
    updateValidationStatus("valid", "✓ Valid JSON");
    showOutput("✓ Valid JSON!");
  } catch (error) {
    updateValidationStatus("invalid", `✗ Invalid: ${error.message}`);
    showOutput(`Invalid JSON: ${error.message}`, true);
  }
}

/**
 * Update validation status display
 */
function updateValidationStatus(state = "", message = "JSON Editor") {
  validationStatus.textContent = message;
  validationStatus.className = state;

  editorWrapper.classList.remove("valid-json", "invalid-json");
  if (state === "valid") {
    editorWrapper.classList.add("valid-json");
  } else if (state === "invalid") {
    editorWrapper.classList.add("invalid-json");
  }
}

/**
 * Auto-validate on edit (debounced)
 */
let validationTimeout;
function autoValidate() {
  clearTimeout(validationTimeout);
  validationTimeout = setTimeout(() => {
    const code = editor.state.doc.toString().trim();

    if (!code) {
      updateValidationStatus("", "JSON Editor");
      return;
    }

    try {
      JSON.parse(code);
      updateValidationStatus("valid", "✓ Valid JSON");
    } catch (error) {
      const shortMsg = error.message.split("\n")[0].substring(0, 50);
      updateValidationStatus("invalid", `✗ ${shortMsg}`);
    }
  }, 500);
}

/**
 * Event listeners
 */
startBtn.addEventListener("click", startAudio);
stopBtn.addEventListener("click", stopAudio);
runBtn.addEventListener("click", runUserCode);
clearBtn.addEventListener("click", clearEditor);
validateBtn.addEventListener("click", validateJSON);
if (silenceBtn) {
  silenceBtn.addEventListener("click", applySilencePatch);
}
if (stressBtn) {
  stressBtn.addEventListener("click", () => startStressTest(5000));
}

// Worklet toggle
workletToggle.addEventListener("change", async (e) => {
  const enabled = e.target.checked;
  audioEngine.useWorklet = enabled;
  showOutput(
    `Worklet ${enabled ? "enabled" : "disabled"}. Restarting audio...`,
  );
  await audioEngine.reset();
  await startAudio();
});

// Patch selector change
patchSelector.addEventListener("change", (e) => {
  loadPatch(e.target.value);
  // Reset dropdown to placeholder
  setTimeout(() => {
    e.target.value = "";
  }, 100);
});

if (patchCategory) {
  patchCategory.addEventListener("change", (e) => {
    selectedCategory = e.target.value || "All";
    populatePatchSelector();
  });
}

// Initialize CodeMirror editor
editor = createEditor(editorWrapper, autoValidate);

// Load patch list
loadPatchIndex();

// Attempt to auto-start audio (may require user gesture)
if (!autoStartAttempted) {
  autoStartAttempted = true;
  startAudio();
}

// Fallback: start audio on first user interaction
const autoStartOnInteraction = () => {
  if (!audioEngine.isRunning) {
    startAudio();
  }
  document.removeEventListener("pointerdown", autoStartOnInteraction);
  document.removeEventListener("keydown", autoStartOnInteraction);
};
document.addEventListener("pointerdown", autoStartOnInteraction, {
  once: true,
});
document.addEventListener("keydown", autoStartOnInteraction, { once: true });

// Keyboard shortcut: Ctrl+Enter or Cmd+Enter to run
editor.dom.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    runUserCode();
  }
});

// Initial status
updateStatus("Not Started");
updateAudioHint(audioEngine.isRunning);
autoValidate(); // Initial validation
updateDebugInfo(); // Initial debug info

// Update debug info periodically to show real-time state
setInterval(updateDebugInfo, 500);

console.log('Live Audio Coding initialized. Press "Start Audio" to begin.');
