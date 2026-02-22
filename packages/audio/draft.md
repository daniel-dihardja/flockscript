# Web Audio + AudioWorklet + WASM DSP (FAUST or Rust/C++)

## A Solid Foundation for a Live-Coding Drone/Noise Environment

This stack is one of the most robust modern approaches for building a serious live-coding audio engine in the browser.

---

# 1. Big Picture Architecture

The idea:

- **Web Audio** = host, routing, scheduling, output
- **AudioWorklet** = real-time audio thread
- **WASM DSP** = compiled high-performance DSP core

You separate UI from audio processing completely.

---

# 2. Web Audio (Host Layer)

Web Audio provides:

- `AudioContext` (audio clock)
- Routing graph (GainNode, DelayNode, BiquadFilterNode, etc.)
- Device output
- Time-based scheduling (`currentTime`)

Think of Web Audio as your “mini DAW host.”

It:

- connects nodes
- schedules transitions
- mixes signals
- outputs audio

It should not contain heavy DSP logic.

---

# 3. AudioWorklet (Real-Time Audio Thread)

`AudioWorkletProcessor` runs on the audio rendering thread.

Why this matters:

The main thread handles:

- UI rendering
- typing in editor
- parsing DSL
- garbage collection
- timers
- network
- layout

Any hiccup there can glitch audio.

AudioWorklet:

- runs independently
- processes audio in small blocks (typically 128 frames)
- must stay real-time safe (no blocking, no heavy allocations)

Inside the processor:

process(inputs, outputs, parameters) {
// fill output buffers here
}

This is where audio must remain stable.

---

# 4. WASM DSP (Compiled Audio Core)

WebAssembly (WASM) allows you to:

- compile DSP from FAUST / Rust / C++
- run it inside AudioWorklet
- execute tight sample loops efficiently
- avoid GC instability
- reuse DSP logic across platforms

Instead of writing heavy DSP in JS,
you call a compiled `processBlock()` function from WASM.

This gives:

- higher performance
- more predictable timing
- more complex DSP possibilities

---

# 5. FAUST vs Rust/C++

## FAUST (Fastest Path for Synth Work)

FAUST is a DSP-specific language.

Strengths:

- extremely compact DSP descriptions
- built-in filters, oscillators, routing
- easy WebAudio + WASM generation
- excellent for synth algorithm experimentation

Ideal if:

- you want to live-code synthesis algorithms
- you want rapid iteration
- you want to focus on sound design

---

## Rust / C++ (More Engineering Control)

Rust:

- memory safe
- strong ecosystem
- good long-term maintainability

C++:

- traditional audio dev language
- huge DSP ecosystem
- very mature tooling

Better if:

- you want a custom DSP engine
- you want long-term platform control
- you want potential native reuse

---

# 6. How Hot Reload Works in This Architecture

This integrates perfectly with your A/B crossfade model.

Flow:

1. User edits patch or DSP
2. Main thread:
   - parses / compiles DSP → produces WASM module
3. Worklet:
   - loads new DSP instance
   - initializes muted
4. At scheduled beat time:
   - crossfade old → new
5. Dispose old instance after tail

This is true **hot-swappable DSP**.

---

# 7. Why This Matters for Drone / Noise

Drone/noise systems often need:

- heavy feedback networks
- nonlinear distortion
- chaotic modulation
- comb filters / resonators
- multiple parallel voices
- spectral-ish processing

Pure Web Audio nodes can handle basic synthesis,
but complex custom DSP can overload the main thread or become unstable.

Worklet + WASM ensures:

- stable timing
- safe heavy DSP
- fewer glitches during UI activity
- scalable complexity

---

# 8. Practical Mental Model

## Main Thread (UI Layer)

Responsible for:

- code editor
- parsing DSL
- compiling DSP
- scheduling swap times
- sending messages to Worklet

Never do heavy DSP here.

---

## AudioWorklet (Audio Engine Layer)

Responsible for:

- owning patch instances
- calling WASM DSP
- managing A/B crossfade
- safety limiting
- producing final output

This layer must stay minimal and deterministic.

---

# 9. When You Actually Need This Stack

You can start with pure Web Audio nodes if:

- you only use OscillatorNode / BiquadFilterNode / DelayNode
- your patches are small
- DSP is simple

Move to Worklet + WASM when:

- you want custom oscillators
- you want advanced filters/resonators
- you want chaotic systems
- you want better stability under UI load
- you want serious feedback networks
- you want future portability

For a drone/noise live-coding instrument,
you will likely want this sooner than later.

---

# 10. Two Possible Live Coding Directions

## Current Project Decision (JSON Patch Format)

For this project we will **stick to the existing JSON patch format** for now.

That means:

- The UI continues to emit JSON patch objects (oscillators/noise/voices/effects/routing).
- The A/B swap remains at the patch level (replace‑only) using the JSON patch data.
- Any future Worklet/WASM exploration should include a JSON‑to‑DSP translation layer,
  but that is **out of scope** for now.

### JSON-to-DSP Boundary (Spike Notes)

- JSON remains the **authoring format** (oscillators/noise/voices/effects/routing).
- The Worklet becomes the **execution layer**, receiving JSON patches.
- A future translation layer can map JSON → DSP graph (FAUST/Rust/C++) without changing UI.
- Current pipeline loads FAUST modules by name (e.g., `gain`, `lowpass`) from `/public/faust`.
- Patch field `faust.module` selects the DSP; `faust.params` maps to FAUST UI controls.
- Patch field `faust.bypassEffects` skips JS effects when using FAUST.

**Next practical step after spike:** replace the no-op `processBlock()` with a simple DSP op
(e.g., passthrough or gain) to verify audio buffer integration.

## A) Patch DSL (Graph Description)

User writes something like:

noise(brown)
|> svf(freq=200 + lfo(0.01)\*100, q=8)
|> delay(0.3, fb=0.92)
|> drive(2.5)
|> out

You:

- parse DSL
- build graph
- crossfade A/B instances

Best for modular-style systems.

---

## B) DSP Code (FAUST-like)

User writes synthesis algorithm directly.

Example conceptually:
