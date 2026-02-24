# FlockScript Audio Patch Format Documentation

## Overview

FlockScript uses a JSON-based patch format for defining live-codable audio compositions. Each patch describes oscillators, noise sources, voices, modulators, effects, and routing in a declarative, real-time editable format.

**Schema Location:** [patch-schema.json](../../patches/patch-schema.json)

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Patch Structure](#patch-structure)
3. [Sound Sources](#sound-sources)
4. [Modulators](#modulators)
5. [Routing](#routing)
6. [Effects](#effects)
7. [Examples](#examples)
8. [Best Practices](#best-practices)
9. [Organization](#organization)
10. [Schema Validation](#schema-validation)
11. [Reference](#reference)

---

## Core Concepts

### Live Coding Philosophy

Patches are designed for **real-time manipulation** during performance. Changes take effect immediately via hot-reload architecture with dual A/B channel crossfading.

### Audio Architecture

```
Sound Sources → Modulators → Voices (ADSR) → JS Effects → Limiter → Output
```

### Dual Channel System

- **Channel A** and **Channel B** run in parallel AudioWorklet nodes
- Crossfade on patch change eliminates clicks/pops
- Each channel maintains independent oscillator/voice pools

---

## Patch Structure

A patch is a JSON object with these top-level properties:

```json
{
  "oscillators": [...],      // Continuous tone generators
  "noise": [...],            // White noise sources
  "voices": [...],           // Sequenced/triggered sounds with envelopes
  "modulators": [...],       // LFOs, sample & hold, chaos
  "routing": [...],          // Modulation connections
  "effects": [...]          // JS-based audio effects
}
```

All properties are optional. An empty `{}` patch produces silence.

---

## Sound Sources

### Oscillators

Continuous tone generators with stable waveforms.

```json
{
  "oscillators": [
    {
      "id": "bass", // Required: Unique identifier
      "freq": 110, // Frequency in Hz (20-20000)
      "gain": 0.3, // Volume level (0-1)
      "type": "sawtooth", // Waveform: sine|square|sawtooth|triangle
      "detune": 0, // Pitch offset in cents (-1200 to 1200)
      "pan": 0 // Stereo position: -1 (left) to 1 (right)
    }
  ]
}
```

**Use Cases:**

- Bass lines (`freq: 55-220`, `type: "sawtooth"`)
- Pads (`freq: 220-880`, `type: "sine"`, low `gain`)
- Drones (steady `freq`, modulated `gain`)

### Noise Sources

White noise generators for percussive/textural elements.

```json
{
  "noise": [
    {
      "id": "hiss", // Required: Unique identifier
      "gain": 0.1, // Volume level (0-1)
      "pan": 0 // Stereo position (-1 to 1)
    }
  ]
}
```

**Use Cases:**

- Hi-hats (short envelope, bandpass filter)
- Snares (mid-envelope, bandpass filter)
- Ambient texture (low `gain`, delay effect)

### Voices

Sequenced sounds with ADSR envelopes, ideal for rhythmic patterns.

```json
{
  "voices": [
    {
      "id": "kick",
      "source": {
        "type": "oscillator", // oscillator | noise
        "freq": 60, // For oscillator
        "wave": "sine" // For oscillator: sine|square|sawtooth|triangle
      },
      "envelope": {
        "attack": 0.001, // Seconds (0.001-5)
        "decay": 0.05, // Seconds (0.001-5)
        "sustain": 0.3, // Level (0-1)
        "release": 0.1 // Seconds (0.001-5)
      },
      "sequence": {
        "pattern": [1, 0, 0, 0, 1, 0, 0, 0], // 1=trigger, 0=rest
        "rate": 8 // Steps per second (0.1-100)
      },
      "gain": 1.0, // Voice volume (0-1)
      "pan": 0, // Stereo position (-1 to 1)
      "filter": {
        // Optional per-voice filter
        "type": "lowpass", // lowpass|highpass|bandpass|notch
        "freq": 200, // Hz (20-20000)
        "q": 1 // Resonance (0.0001-100)
      }
    }
  ]
}
```

**ADSR Envelope Stages:**

- **Attack:** Fade-in time from 0 to peak
- **Decay:** Fall time from peak to sustain level
- **Sustain:** Held level while pattern step is active
- **Release:** Fade-out time after step ends

**Pattern Design:**

- `[1, 0, 0, 0]` = downbeat (kick drum)
- `[0, 0, 1, 0]` = backbeat (snare)
- `[1, 0, 1, 0, 1, 0, 1, 0]` = 8th notes (hi-hat)

---

## Modulators

Low-frequency control signals that modulate parameters over time.

### LFO (Low Frequency Oscillator)

Periodic modulation with waveforms.

```json
{
  "modulators": [
    {
      "type": "lfo",
      "id": "wobble",
      "rate": 2, // Hz (0.01-100)
      "depth": 50, // Modulation amount
      "wave": "sine" // sine|square|sawtooth|triangle
    }
  ]
}
```

**Use Cases:**

- Tremolo (`param: "gain"`, sine wave)
- Vibrato (`param: "frequency"`, sine wave)
- Filter sweep (`param: "freq"`, triangle wave)

### Sample & Hold

Stepped random values at regular intervals.

```json
{
  "modulators": [
    {
      "type": "sampleHold",
      "id": "random",
      "rate": 8, // Steps per second (0.1-100)
      "min": 100, // Minimum output value
      "max": 2000 // Maximum output value
    }
  ]
}
```

**Use Cases:**

- Random pitch jumps (classic 8-bit arpeggio)
- Glitchy filter cutoff changes
- Stepped panning effects

### Chaos

Smooth random walk modulation.

```json
{
  "modulators": [
    {
      "type": "chaos",
      "id": "drift",
      "rate": 10, // Update rate in Hz (0.1-100)
      "center": 500, // Center value
      "range": 500, // Max deviation from center (0+)
      "step": 0.2 // Step size per update (0-1)
    }
  ]
}
```

**Use Cases:**

- Organic filter movement
- Subtle pitch drift
- Evolving resonance (Q parameter)

---

## Routing

Connect modulators to parameters of oscillators, noise sources, or effects.

```json
{
  "routing": [
    {
      "from": "wobble", // Source modulator ID
      "to": "bass", // Target oscillator/effect ID
      "param": "frequency" // Parameter to modulate
    }
  ]
}
```

**Valid Parameters:**

- `frequency` / `freq` - Pitch (oscillators, filters)
- `detune` - Pitch offset (oscillators)
- `gain` - Volume (oscillators, noise)
- `q` - Filter resonance (filters)
- `time` - Delay time (delay effect)
- `feedback` - Delay feedback (delay effect)

**Multi-Target Example:**

```json
{
  "routing": [
    { "from": "lfo1", "to": "osc1", "param": "frequency" },
    { "from": "lfo1", "to": "osc2", "param": "frequency" },
    { "from": "lfo2", "to": "filter1", "param": "freq" }
  ]
}
```

---

## Effects

JavaScript-based audio effects processed in the AudioWorklet.

### Filter

Biquad filter with modulation support.

```json
{
  "effects": [
    {
      "type": "filter",
      "id": "lpf", // Optional: for routing
      "filterType": "lowpass", // lowpass|highpass|bandpass|notch
      "freq": 1000, // Cutoff Hz (20-20000)
      "q": 1 // Resonance (0.0001-1000)
    }
  ]
}
```

### Delay

Echo/repeat effect with feedback.

```json
{
  "effects": [
    {
      "type": "delay",
      "id": "echo", // Optional: for routing
      "time": 0.375, // Delay time in seconds (0-5)
      "feedback": 0.6 // Feedback amount (0-1)
    }
  ]
}
```

**Tip:** Musical delay times at 120 BPM:

- Quarter note: `0.5s`
- Eighth note: `0.25s`
- Dotted eighth: `0.375s`

### Distortion

Waveshaper saturation.

```json
{
  "effects": [
    {
      "type": "distortion",
      "amount": 50 // Distortion amount (0-400)
    }
  ]
}
```

### Gain

Simple volume control.

```json
{
  "effects": [
    {
      "type": "gain",
      "value": 0.8 // Gain multiplier (0-2)
    }
  ]
}
```

### Compressor

Dynamic range compressor for controlling volume dynamics.

```json
{
  "effects": [
    {
      "type": "compressor",
      "threshold": -24, // dB: compression starts above this level (-60 to 0)
      "ratio": 4, // Compression ratio (1-20, e.g., 4 means 4:1)
      "attack": 0.003, // Seconds: how fast compression engages (0.0001-1)
      "release": 0.25, // Seconds: how fast it disengages (0.001-3)
      "knee": 0, // dB: 0=hard knee, >0=soft knee (0-40)
      "makeup": 0 // dB: compensates for gain reduction (-20 to 40)
    }
  ]
}
```

**Use Cases:**

- **Tame loud peaks:** `threshold: -12, ratio: 8, attack: 0.001, release: 0.1`
- **Add punch:** `threshold: -18, ratio: 4, attack: 0.005, release: 0.15, makeup: 6`
- **Subtle glue:** `threshold: -24, ratio: 2, attack: 0.01, release: 0.3, knee: 10`

---

## Examples

### Example 1: Wobble Bass

Classic dubstep-style wobble with LFO-modulated filter.

```json
{
  "oscillators": [
    {
      "id": "bass",
      "freq": 55,
      "gain": 0.4,
      "type": "sawtooth"
    }
  ],
  "modulators": [
    {
      "type": "lfo",
      "id": "wobble",
      "rate": 4,
      "depth": 600,
      "wave": "sine"
    }
  ],
  "routing": [
    {
      "from": "wobble",
      "to": "lpf",
      "param": "freq"
    }
  ],
  "effects": [
    {
      "type": "filter",
      "id": "lpf",
      "filterType": "lowpass",
      "freq": 800,
      "q": 5
    }
  ]
}
```

### Example 2: Kick Drum

Low-frequency kick with pitch envelope.

```json
{
  "voices": [
    {
      "id": "kick",
      "source": {
        "type": "oscillator",
        "freq": 60,
        "wave": "sine"
      },
      "envelope": {
        "attack": 0.001,
        "decay": 0.05,
        "sustain": 0.2,
        "release": 0.1
      },
      "sequence": {
        "pattern": [1, 0, 0, 0],
        "rate": 4
      },
      "gain": 1.0,
      "filter": {
        "type": "lowpass",
        "freq": 150,
        "q": 1
      }
    }
  ]
}
```

### Example 3: Ambient Texture

Layered noise with delay and a gentle filter.

```json
{
  "noise": [
    {
      "id": "texture",
      "gain": 0.15,
      "pan": 0
    }
  ],
  "effects": [
    {
      "type": "delay",
      "time": 0.75,
      "feedback": 0.4
    },
    {
      "type": "filter",
      "filterType": "lowpass",
      "freq": 600,
      "q": 2
    }
  ]
}
```

### Example 4: Random Arpeggio

Sample & hold modulating oscillator pitch.

```json
{
  "oscillators": [
    {
      "id": "lead",
      "freq": 440,
      "gain": 0.3,
      "type": "square"
    }
  ],
  "modulators": [
    {
      "type": "sampleHold",
      "id": "arp",
      "rate": 8,
      "min": 200,
      "max": 1200
    }
  ],
  "routing": [
    {
      "from": "arp",
      "to": "lead",
      "param": "frequency"
    }
  ]
}
```

---

## Best Practices

### Performance

- **Oscillator Pooling:** Worklet reuses oscillators (max 16), enable/disable based on patch
- **Voice Pooling:** Voices reuse envelope generators (max 8)
- **Limiter Safety:** Automatic hard limiting at ±0.95 prevents clipping

### Live Coding

- **Start Simple:** Begin with 1-2 oscillators, add complexity gradually
- **Modulation Depth:** Start with low `depth` values, increase for dramatic effect
- **Crossfade Time:** Engine uses 30ms crossfade, allows rapid patch changes
- **Silence Patch:** Keep QA-01 (silence) handy for emergency mute

### Composition

- **Frequency Ranges:**
  - Sub-bass: 20-60 Hz
  - Bass: 60-250 Hz
  - Mids: 250-2000 Hz
  - Highs: 2000-20000 Hz

- **Gain Staging:**
  - Single oscillator: `gain: 0.3`
  - Multiple oscillators: `gain: 0.1-0.2` each
  - Voices with sharp envelopes: `gain: 0.8-1.0`
  - Noise sources: `gain: 0.05-0.15`

- **Filter Q Values:**
  - Subtle: `q: 1-2`
  - Resonant: `q: 5-10`
  - Aggressive: `q: 20+`

### Debugging

- **Debug Panel:** Real-time status shows active channel, channel gains, and pending swaps
- **QA Patches:** Use `patches/single-sounds/` for testing individual features
- **Incremental Changes:** Modify one parameter at a time during debugging

### Organization

- **Patch Structure:**

  ```
  patches/
  ├── single-sounds/    # Basic test patches
  ├── modulation/       # LFO/chaos examples
  ├── effects/          # Effect chain demos
  ├── percussion/       # Drum voices
  ├── composition/      # Full pieces
  └── pulse/            # Pulsed and rhythmic examples
  ```

- **Naming Convention:** `qa-##-description.json` for test patches, `descriptive-name.json` for compositions

- **Manifest:** Register patches in `manifest.json` for editor dropdown

---

## Schema Validation

The JSON schema provides autocomplete and validation in editors like VS Code.

**Enable validation in VS Code:**

1. Add to `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["patches/**/*.json"],
      "url": "../../patches/patch-schema.json"
    }
  ]
}
```

2. Or add to each patch file:

```json
{
  "$schema": "../../patches/patch-schema.json",
  "oscillators": [...]
}
```

---

## Reference

- **Schema:** [patch-schema.json](../../patches/patch-schema.json)
- **Examples:** All patches in `patches/` subdirectories

## FlockScript Reference

The DSL compiler (`packages/compiler/README.md`) turns live-coded commands into JSON patches that satisfy this schema:

- **Main Keywords:** `osc`, `noise`, `lfo`, `samplehold`, `chaos`, `fx`, `route`, and `silence` (plus aliases such as `sin`, `sqr`, `noi`, `sil`).
- **Voice (`voi`)**: defines sequenced sources with envelopes, filters, and step patterns (`seq ... rate ...`). See `packages/compiler/FLOCKSCRIPT.md` for the exact syntax.
- **Parameter normalization:** Frequencies, gains, detune/pan, envelope stages, and effect settings are clamped and routed through `CompilePatch` before the patch reaches the engine.
- **Effects coverage:** Web Audio effects—`filter`, `delay`, `distortion`, `gain`, `reverb`, and `compressor`—are emitted from `fx` lines so the PatchBuilder can rebuild those native nodes with the matching schema parameters.
- **Routing (`route`)** now includes the `pan` parameter, allowing modulators to sweep stereo position directly in FlockScript.
- **Effects coverage:** `filter`, `delay`, `distortion`, `gain`, and `compressor` obey their schema-defined fields.
- **Silence mode:** `sil`/`silence` is a no-op patch that keeps diagnostics green yet forces silence on the engine.

Combine this reference with the schema when extending the DSL so every new command feeds the audio engine with valid JSON.

---

**Version:** 1.0  
**Last Updated:** February 22, 2026
