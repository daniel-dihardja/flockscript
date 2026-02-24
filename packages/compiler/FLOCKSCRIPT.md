# FlockScript Quick Reference

FlockScript is the live-coding language you write in `apps/web/components/editor/live-editor.tsx`. It is compiled by `packages/compiler/src/index.ts` into the JSON patch schema (`packages/patches/patch-schema.json`) which the audio engine consumes.

## Command structure

- **General form:** `command target args…`
- **Keywords** are case-insensitive and often have 3-letter aliases (`osc`, `lfo`, `fx`, `route`, `sil`, `noi`, etc.).
- **Numeric values** can use `@` to denote gain (`@0.2`) or plain numbers for freq/detune/pan.
- **Lines are independent**: run a single line (`Mod+Enter`/`Cmd+Enter`) or multiple lines together.

## Examples

### Example 1 – single oscillator

```
osc bass sin 110 @0.2
```

Creates an oscillator named `bass` with sine wave, 110 Hz frequency, and gain 0.2. The compiler normalizes `sin`→`sine`, clamps frequency/gain to schema ranges, and emits:

```json
{
  "oscillators": [
    { "id": "bass", "type": "sine", "freq": 110, "gain": 0.2, "pan": 0 }
  ]
}
```

### Example 2 – modulated tone

```
osc lead sqr 440 @0.15
lfo wobble sin rate 2 depth 800
route wobble -> lead freq
```

`lfo` defines a slow oscillator (`rate 2` Hz) that modulates `lead` frequency by ±800 cents (`depth`). `route` wires `wobble` to `lead`’s `freq` parameter. The compiler produces `modulators` and `routing` objects matching the schema.

`route` can also target `pan`, so commands like `route wobble -> lead pan` modulate stereo position directly from FlockScript.

### Example 3 – sequenced voice

```
voi kick osc sin 60 @0.5 pan -0.2 env 0.001 0.02 0.6 0.1 seq 1 0 1 0 rate 4 filter lowpass freq 150 q 2
```

`voi` (alias for `voice`) defines a sequenced voice: an oscillator source, ADSR envelope, stereo pan, a 4-step sequence, and a filter. The compiler emits `voices[]` entries with `source`, `envelope`, `sequence`, `filter`, and `pan` that the audio engine uses to trigger rhythmically.

### Example 4 – simple effect

```
fx bass-filter filter lowpass freq 600 q 4
```

Creates a filter effect `bass-filter` (type `filter`) with cutoff 600 Hz and resonance 4. Combine with oscillators/modulators in the same block to let the PatchBuilder route sources through the effect chain.

The `fx` command currently supports the Web Audio nodes `filter`, `delay`, `distortion`, `gain`, `reverb`, and `compressor`, so you can chain the same native effects from FlockScript.

### Example 5 – reverb tail

```
fx hall reverb duration 3 decay 2 reverse false
```

The `reverb` effect uses the Web Audio convolution chain to add spacey tails. The compiler emits a `reverb` entry with `duration`, `decay`, and `reverse` flags alongside the other built-in effects (filter, delay, distortion, gain).

### Example 6 – silence quick mute

```
sil
```

`sil`/`silence` immediately generates an empty patch while keeping diagnostics `ok`. Useful for muting between experiments.

## Workflow

1. Write FlockScript line(s) in the editor.
2. The frontend worker calls `compile()` (see `packages/compiler/README.md`).
3. On success, the resulting JSON patch (`CompilePatch`) is passed to `PatchBuilder`.
4. `PatchBuilder` builds/updates the Web Audio graph inside the engine.

## Next steps

- Add new keywords by extending the compiler’s `switch` near the bottom of `packages/compiler/src/index.ts`.
- Verify JSON output against `packages/patches/patch-schema.json` (same schema referenced in `packages/audio/patches/README.md`).
- Use the live diagnostics (“Unknown statement”, range errors) to iteratively refine commands.
