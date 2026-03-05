# FlockScript – compiler reference

FlockScript is the small language you write in `apps/web/components/editor/live-editor.tsx`.  
The compiler in `packages/compiler/src/index.ts` turns it into a JSON patch (`CompilePatch`) that the audio engine consumes.

---

## Supported commands

### `osc` – oscillator device

```flock
osc <id?> wave=<wave> frequency=<hz> gain=<number> [detune=<cents>] [pan=<value>]
```

| Argument | Description |
|---|---|
| `<id?>` | Optional name. Defaults to `osc-auto-<n>`. |
| `wave` | Waveform: `sine`/`sin`, `square`/`sqr`, `sawtooth`/`saw`, `triangle`/`tri`. |
| `frequency` | Base frequency in Hz (aliases: `freq`, `frq`). |
| `gain` | Amplitude 0–1. Shorthand: `@0.25`. |
| `detune` | Pitch offset in cents (alias: `dtn`), clamped to [-1200, 1200]. |
| `pan` | Stereo position from -1 (left) to 1 (right). |

### `output` – master output device

```flock
output <id?> gain=<number>
```

- `<id?>` defaults to `out`.
- `gain` is clamped to [0, 1].

### Route lines

```flock
[id1, id2, ...] -> targetId
```

Connects the listed device outputs to a target device's input. Generates one `RouteDefinition` per source.

---

## Full example (Basic / Syntax draft)

```flock
osc osc1 wave=sine frequency=80 gain=0.7
osc osc2 wave=sine frequency=432 gain=0.03
output out gain=1

[osc1, osc2] -> out
```

---

## Patch shape

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

> Quick mute / silence is handled at the editor + audio engine level, not by the compiler.

---

## Modular device architecture

The compiler is structured so that each device type lives in its own module under `packages/compiler/src/devices/`:

```
packages/compiler/src/
  index.ts              ← thin orchestrator: split lines, dispatch to devices
  types.ts              ← shared types: DeviceDefinition, RouteDefinition, DeviceCompiler, …
  diagnostics.ts        ← helper for building CompileDiagnostic values
  utils.ts              ← clamp, parseNumber, resolveWave, …
  devices/
    index.ts            ← central registry: Map<keyword, DeviceCompiler>
    osc.ts              ← compileOsc()
    output.ts           ← compileOutput()
    route.ts            ← compileRoutes()
```

### Key types

```ts
/** Shared context passed to every device compiler. */
type DeviceCompileContext = {
  lines: string[];
  lineIndex: number;
  diagnostics: CompileDiagnostic[];
};

/** Contract every device compiler must satisfy. */
type DeviceCompiler = (
  tokens: string[],
  context: DeviceCompileContext,
  devices: DeviceDefinition[],
  routes: RouteDefinition[],
) => void;
```

### Adding a new device (e.g. `lfo`)

1. **Create `devices/lfo.ts`** and export `compileLfo` with signature `DeviceCompiler`.
2. **Add `LfoParams`** (and optionally extend `DeviceType`) in `types.ts`.
3. **Register it** in `devices/index.ts`:

```ts
import { compileLfo } from "./lfo.ts";

const DEVICE_REGISTRY = new Map<string, DeviceCompiler>([
  ["osc",    compileOsc],
  ["output", compileOutput],
  ["lfo",    compileLfo],   // ← new line
]);
```

4. **Add tests** in `index.test.ts` (or a dedicated `lfo.test.ts`).
5. **Document** the new syntax in this file.

No changes to `index.ts` are needed — the registry lookup handles dispatch automatically.
