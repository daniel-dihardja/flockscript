# FlockScript Live Coding Workspace

This Workspace hosts the **FlockScript** live-coding environment for drone, noise, and experimental audio performance. FlockScript is the custom DSL implemented in this project—it's not a pre-existing language, but the specific script that authoring happens in. The main web app (`apps/web`) exposes a CodeMirror-based IDE where you write FlockScript to compile to the JSON patch schema consumed by the audio engine. Behind the scenes there is:

- a **compiler** package (`packages/compiler`) that parses the DSL, validates it, and emits the device/route JSON,
- an **audio** package (`packages/audio`) that exposes the shared audio engine, patch builder, and worklet logic used by both the playground and the Next.js app,
- the **web** app (`apps/web`) that wires the editor, compiler worker, diagnostics, theming, and playback UI.

## Getting started

1. Install dependencies at the workspace root:
   ```bash
   pnpm install
   ```
2. Run the Next.js app (which loads the compiler+audio packages internally):
   ```bash
   pnpm --filter web dev
   ```
   The live editor is mounted at `/`, and the dedicated audio test playground is at `/audio-test`.
3. Use the editor samples or write your own FlockScript lines like:

   ```text
   osc osc1 wave=sine frequency=80 gain=0.7
   osc osc2 wave=sine frequency=432 gain=0.03
   output out gain=1

   [osc1, osc2] -> out
   ```

   Press `Cmd+Enter` (or `Ctrl+Enter`) to run the current block, `Shift+Enter` for the current line, and `Alt+Enter` for a selection.

## Packages

### `/apps/web`

- Next.js 16 + Turbopack driven SPA with the live editor UI.
- CodeMirror 6 powered editor that highlights FlockScript keywords, track engine diagnostics, and dispatches evaluation commands to the compiler worker.
- Uses a web worker (`apps/web/components/editor/workers/dsl-worker.ts`) to parse scripts via the compiler and relay diagnostics/patches.

### `/packages/compiler`

- TypeScript DSL compiler that understands `osc`, `output`, `[sources] -> target`, plus aliases for short keywords.
- Emits the JSON patch schema (`devices` + `routes`) automatically validated before being transferred to the audio engine.
- Includes diagnostics helpers, parser primitives, and unit tests (`pnpm --filter @workspace/compiler test`).

### `/packages/audio`

- Provides `audioEngine` and `PatchBuilder` to initialize the AudioWorklet, validate incoming patches against `packages/patches/patch-schema.json`, and push JSON to the worklet.
- Uses `ajv` for schema validation.
- Bundled via `tsup`, with the compiled output published under `dist/` for reuse in other projects.

## Patch Schema

The JSON patch schema (see `packages/patches/patch-schema.json`) describes `devices` (oscillators + outputs) and `routes` with `from`/`to` targets over `audio` signals. Both `devices` and `routes` are required arrays, and each device may provide optional `id`/`params` fields.

## Development helpers

- Run the compiler tests: `pnpm --filter @workspace/compiler test`.
- Build the audio package (used by the web app at runtime): `pnpm --filter @workspace/audio build`.
- Format/check the web app as usual with `pnpm --filter web lint` / `pnpm --filter web typecheck` (you may need to adjust the lint script first).

## Suggested workflow

1. Write FlockScript statements in the live editor.
2. The compiler worker compiles to JSON and sends it to the `PatchBuilder`.
3. Audio package validates and forwards the patch to the AudioWorklet.
4. Observe diagnostics and tweak scripts or theme variations on the fly.

This README will evolve as you expand the DSL, add modulators/effects, or expose MIDI/control mapping next.
