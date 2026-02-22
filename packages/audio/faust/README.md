# FAUST DSP

This folder contains FAUST DSP sources used to generate WebAssembly modules.

## Install (macOS)

- `brew install faust`

## Build

- `npm run faust:build`

Note: Don’t append extra arguments (e.g., a trailing `.`). That will be passed to `faust` and can cause scanner errors.

## Available Modules

### Basic DSP

- `gain.dsp` → Simple stereo gain control
- `lowpass.dsp` → 2-pole lowpass filter

### Effects (Drone/Noise Music)

- `reverb.dsp` → Freeverb-based stereo reverb (roomSize, damping, wetDry)
- `bitcrusher.dsp` → Sample rate + bit depth reduction (sampleRate, bitDepth, wetDry)
- `ringmod.dsp` → Ring modulator with carrier oscillator (carrierFreq, waveform, wetDry)

## Usage in Patches

```json
{
  "faust": {
    "module": "reverb",
    "bypassEffects": true,
    "params": {
      "roomSize": 0.8,
      "damping": 0.6,
      "wetDry": 0.7
    }
  }
}
```

See `patches/wasm/` for test examples.

For more FAUST DSP ideas, see [DSP_IDEAS.md](./DSP_IDEAS.md).
Output is written to `public/faust/gain.wasm` and loaded by the Worklet when available.

Additional DSPs:

- `faust/lowpass.dsp` → `public/faust/lowpass.wasm`

## Notes

- The current Worklet expects an export named `processBlock` plus `memory`.
- FAUST-generated WASM typically exports `compute` instead.
- The loader will report `wasm-unsupported-exports` until the interface is adapted.
