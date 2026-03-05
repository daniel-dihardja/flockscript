# FlockScript – Basic syntax used by the live editor

FlockScript is the small language you write in `apps/web/components/editor/live-editor.tsx`.  
The compiler in `packages/compiler/src/index.ts` turns it into a JSON patch (`CompilePatch`) that the audio engine consumes.

For now the compiler only implements the minimal subset used by the **Basic / Syntax draft** example in the editor.

## Commands

### `osc` – oscillator device

General form (order of arguments does not matter except for the `@gain` shorthand):

```flock
osc <id?> wave=<wave> frequency=<hz> gain=<number> [detune=<cents>] [pan=<value>]
```

- `<id?>`: optional name for the oscillator. If omitted, an id like `osc-auto-1` is generated.
- `wave`: waveform name. Supported: `sine`, `square`, `sawtooth`, `triangle` (plus short aliases `sin`, `sqr`, `saw`, `tri`).
- `frequency`: base frequency in Hz.
- `gain`: linear amplitude (0–1). You can also write `@0.25` as a shorthand for gain.
- `detune` (optional): pitch offset in cents, clamped to [-1200, 1200].
- `pan` (optional): stereo position from -1 (left) to 1 (right).

The Basic example uses two oscillators:

```flock
osc osc1 wave=sine frequency=80 gain=0.7
osc osc2 wave=sine frequency=432 gain=0.03
```

### `output` – master output device

```flock
output <id?> gain=<number>
```

- `<id?>`: optional output id. If omitted, the id `out` is used.
- `gain`: master gain for the output device.

Example from the Basic block:

```flock
output out gain=1
```

### Route lines – connect oscillators to output

```flock
[id1, id2, ...] -> targetId
```

- Left-hand side: comma‑separated list of oscillator ids.
- Right-hand side: output id to route into.

Example:

```flock
[osc1, osc2] -> out
```

The compiler turns this minimal language into a patch of the form:

```ts
type CompilePatch = {
  devices: {
    id: string;
    type: "osc" | "output";
    params: {
      wave?: "sine" | "square" | "sawtooth" | "triangle";
      frequency?: number;
      gain?: number;
      detune?: number;
      pan?: number;
    };
  }[];
  routes: { from: string; to: string; signal: "audio" }[];
};
```

Anything that is not one of the commands above results in an `Unknown statement` diagnostic.

> Note: quick mute / silence is handled at the editor + audio engine level, not by the compiler.
