# FlockScript Audio Engine

A high-performance audio engine for building live coding environments for drone/noise music. Built on Web Audio API with AudioWorklet processing and FAUST DSP integration.

## Overview

FlockScript Audio Engine provides a declarative JSON-based patch format for real-time audio synthesis and manipulation. It's designed specifically for:

- **Live coding performances** (experimental noise/glitch/ambient/drone music)
- **Algorithmic composition** with modulation systems
- **Browser-based audio exploration** and experimentation

The included browser editor serves as a **playground** for exploring and testing the audio engine capabilities before integration into your own live coding environment.

## Key Features

### Audio Architecture

- **Dual-channel A/B crossfading** - Glitch-free patch transitions with 30ms crossfade
- **Beat-synchronized switching** - Patch changes align to musical timing, ensuring transitions happen on beat
- **AudioWorklet processing** - Low-latency DSP with dedicated audio thread
- **FAUST DSP integration** - WebAssembly-compiled audio effects with hot-swappable modules
- **Object pooling** - Efficient oscillator and voice management (16 oscillators, 8 voices)
- **Hard limiter** - Automatic clipping protection at ±0.95

### Sound Sources

- **Oscillators** - Continuous tones (sine, square, sawtooth, triangle)
- **Noise generators** - White noise sources
- **Voices** - Sequenced sounds with ADSR envelopes and pattern triggers

### Modulation System

- **LFO** - Low-frequency oscillators with multiple waveforms
- **Sample & Hold** - Stepped random modulation
- **Chaos** - Smooth random walk modulation
- **Flexible routing** - Connect any modulator to any parameter

### Effects

- **JavaScript effects** - Filter, delay, distortion, gain (processed in worklet)
- **FAUST effects** - Compiled WASM modules for high-performance DSP
- **Effects bypass** - Skip JS effects when using FAUST-only processing

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open the browser playground at `http://localhost:5173`

### Building FAUST Modules

```bash
npm run faust:build
```

Compiles `faust/*.dsp` files to `public/faust/*.wasm` and `*.json`

### Production Build

```bash
npm run build
```

## Playground Editor

The included browser editor (`index.html`) provides:

- **Live JSON editor** with CodeMirror and syntax validation
- **Real-time patch preview** - Hear changes instantly
- **Patch library** - Curated examples and test patches
- **Debug panel** - Real-time status monitoring (active channel, FAUST module, parameters)

**Use Case:** Experiment with patch design, test audio parameters, and understand the engine capabilities before building your custom live coding interface.

## Patch Format

Patches are declarative JSON documents that describe the complete audio state:

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

See [patches/README.md](patches/README.md) for comprehensive documentation.

## FAUST Integration

FAUST (Functional Audio Stream) modules enable high-performance DSP:

```json
{
  "faust": {
    "module": "lowpass",
    "params": {
      "cutoff": 1200
    },
    "bypassEffects": true
  }
}
```

**Included modules:**

- `gain.dsp` - Simple stereo gain control
- `lowpass.dsp` - 2-pole lowpass filter

See [faust/README.md](faust/README.md) for FAUST development.

## Architecture

### Signal Flow

```
Sound Sources → Modulators → Voices (ADSR) → JS Effects → FAUST DSP → Limiter → Output
```

### Dual Channel System

- **Channel A** and **Channel B** run in parallel AudioWorklet nodes
- Crossfade controller manages smooth transitions
- Each channel maintains independent state

### Files

- **audio-engine.js** - AudioContext management, worklet node creation, FAUST module integration
- **worklet/dsp-worklert.js** - AudioWorklet processor (synthesis, effects, FAUST integration)
- **editor.js** - CodeMirror editor setup and patch validation
- **main.js** - UI controls and debug panel
- **patch-builder.js** - Patch library loading and management

## Integration Guide

To integrate FlockScript Audio Engine into your live coding environment:

1. **Import the audio engine:**

```javascript
import { AudioEngine } from "./audio-engine.js";
```

2. **Initialize:**

```javascript
const engine = new AudioEngine();
await engine.init();
```

3. **Apply patches:**

```javascript
await engine.applyPatch(patchJSON);
```

4. **Control master volume:**

```javascript
engine.setMasterGain(0.8); // 0-1
```

The engine handles all crossfading, module loading, and worklet communication automatically.

## Use Cases

### Drone Music

- Long sustained tones with slow modulation
- Layered oscillators with slight detuning
- Chaos modulators for organic evolution

### Noise Music

- White noise with aggressive filtering
- Heavy distortion effects
- Rapid sample & hold modulation

### Glitch

- Fast pattern sequences with short envelopes
- Rapid parameter jumps via sample & hold
- Effects with extreme settings (high Q, heavy distortion)

### Ambient

- Low-gain oscillators with subtle LFO modulation
- Long delay times with moderate feedback
- Smooth filter sweeps

## Documentation

- **[patches/README.md](patches/README.md)** - Complete patch format reference and examples
- **[faust/README.md](faust/README.md)** - FAUST DSP development
- **[patches/patch-schema.json](patches/patch-schema.json)** - JSON schema for validation

## Technical Requirements

- Modern browser with AudioWorklet support (Chrome 66+, Firefox 76+, Safari 14.1+)
- For FAUST development: FAUST compiler (`brew install faust` on macOS)

## License

MIT

---

**Version:** 1.0  
**Last Updated:** February 22, 2026
