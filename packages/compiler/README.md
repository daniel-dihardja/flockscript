# FlockScript DSL Compiler Guide

This package compiles FlockScript lines into the JSON patch format the audio engine consumes. The schema lives under `packages/patches/patch-schema.json`, so keep that file open as the ground truth while you extend or debug the compiler. For a hands-on reference with working samples, see `packages/compiler/FLOCKSCRIPT.md`, which walks through simple lines like `osc bass sin 110 @0.2` and shows the emitted JSON.

## Implemented schema coverage

- **Oscillators (`osc`)** – requires `id`, `wave` name, frequency and gain tokens. The compiler clamps frequencies to 20‑20 kHz, gain to 0‑1, and understands optional `detune` and `pan` values expressed in cents or stereo units.
- **Noise sources (`noise`)** – accepts `id`, gain, and `pan`. Gain tokens must begin with `@`, the same parser that produces oscillator gains.
- **Modulators** – supports `lfo`, `sampleHold`, and `chaos` sections. LFOs accept a waveform plus `rate`, `depth`, and `offset`, while Sample & Hold takes `min`/`max`/`rate` and Chaos needs `center`, `range`, `step`. All values are validated against the schema’s ranges.
- **Routing (`route`)** – accepts `source -> target param` entries where `param` must be one of: `frequency`, `freq`, `detune`, `gain`, `q`, `time`, `feedback`, or `pan`. The new `pan` option lets modulators directly sweep stereo position.
- **Effects (`fx`)** – supports `filter`, `delay`, `distortion`, `gain`, `reverb`, and `compressor`. Each `fx` line emits the schema-defined parameters so the PatchBuilder can recreate the corresponding Web Audio nodes.
- **Silence (`sil` / `silence`)** – reserved no-op command. It produces an empty patch result and bypasses the engine builder while still reporting `ok: true`.
- **Aliases / shorthand** – numerous keyword aliases (`sin`, `sqr`, `tri`, `noi`, `frq`, etc.) map to canonical forms so you get consistent diagnostics.

## How to use the compiler

```ts
import { compile } from "@workspace/compiler";

const source = `
osc bass saw 110 @0.3 detune +5 pan -0.3
lfo slow sine rat 0.25 dep 0.7
route slow -> bass freq
fx basslpf filter lowpass freq 800 q 6
`;

const result = compile(source);
if (!result.ok) {
  console.error("Compilation failed", result.diagnostics);
} else {
  console.log("Patch ready", result.patch);
}
```

The compiler works line-by-line; you can compile blocks, selections, or single lines from the editor. Call `compile` with whatever text you want to validate, then inspect `result.diagnostics` for human-readable guidance.

## Integration notes

- **Live editor** – the workspace editor already calls `compile` via a web worker. Lines that succeed feed the audio engine through `PatchBuilder`.
- **Tests** – run `pnpm -C packages/compiler test` to exercise the Vitest suite in `src/index.test.ts`.
- **Extending** – follow the schema: if you add a new top-level key, extend the `CompilePatch` type and add parsing logic near the bottom of `src/index.ts`.

## Schema-based validation

For TypeScript editors you can attach `packages/patches/patch-schema.json` to your JSON files (`$schema`), giving you IntelliSense/validation. This schema is the same one referenced in the audio patch README and ensures the compiler output matches what the audio engine expects.
