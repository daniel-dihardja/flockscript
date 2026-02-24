# Flockscript Audio Engine

Minimal live-coding audio engine package built with Web Audio and ready for publication.

## Features

- `audioEngine` — manages the AudioContext, dual-channel routing, worklet fallback, and diagnostics.
- `PatchBuilder` — interprets the JSON schema in `/packages/audio/patches` and voices/effects into Web Audio nodes.
- TypeScript source under `/src` that the monorepo consumes directly, plus a `dist` bundle produced via `tsup` for npm consumers.

## Local development

1. `pnpm install` at the repo root (the workspace alias points `@workspace/audio` to `/packages/audio/src/index.ts`).
2. The web app imports the TS source; no additional build is needed locally.

## Publishing

1. `pnpm --filter @workspace/audio run build` (runs `tsup src/index.ts --format esm --dts --out-dir dist --clean`).
2. `pnpm --filter @workspace/audio pack` or `npm publish` uses the `dist` bundle and the `exports` map defined in `package.json`.
3. `files` already include `dist/`, `patches/`, and `worklet/` so external consumers get the runtime assets.

## Patches

Patch JSON lives under `/packages/audio/patches`. The web editor (apps/web) reads `manifest.json` and fetches `patch.json` files via `/api/patch`.

## Diagnostics / Worklets

The engine exposes debugging helpers through the web UI for context status, channel gains, and audio node counts. When you need to add new DSP worklets or JSON schema updates, drop them under `worklet/` or `patches/` and rerun `tsup` to refresh the published bundle.
