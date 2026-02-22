# DSL semantics for the patch compiler

This sketch collects the DSL constructs we want the compiler to understand so it can emit JSON patches that satisfy `packages/patches/patch-schema.json`. It directly addresses **step 1** of the compiler plan: capture the DSL semantics that map to the schema’s sections before building the parser or validator.

## Mapping DSL statements to schema sections

### `oscillators`

The DSL line `osc <id> <wave> <freq> @<gain> [detune <cents>] [pan <value>]` produces one entry in `oscillators[]`.  
Required schema fields: 

- `id` → `<id>`  
- `type` (schema enum: `sine|square|sawtooth|triangle`) → `<wave>`  
- `freq` → `<freq>`  
- `gain` → `@<gain>`  

Optional fields:

- `detune` → pair `detune <cents>`  
- `pan` → `pan <value>`  

Normalize values (e.g., default `gain` to `0.3`, clamp frequency inside 20–20 kHz) to satisfy the schema constraints.

### `noise`

DSL line: `noise <id> @<gain> [pan <value>]`

- `id` → `<id>`  
- `gain` → `@<gain>`  
- `pan` → optional `pan <value>`  

Maps to `noise[]` entries using the schema defaults/limits (gain 0–1, pan −1..1).

### `voices`

Voice sections (`voice <id> source <osc|noise> ... envelope ... sequence ...`) will be optional, but the compiler should be ready to emit `voices[]` entries whenever DSL users define envelopes or patterns.

Key schema groups:

- `source`: object with `type` (`oscillator` or `noise`), optional `freq`, `wave`.  
- `envelope`: `attack`, `decay`, `sustain`, `release`.  
- `sequence`: `pattern` array plus `rate`.  
- Optional `gain`, `pan`, and `filter` objects.  

### `modulators`

Start with the `lfo`, `samplehold`, and `chaos` keywords described in the README. Each line should emit a schema entry in `modulators[]` with a `type` field (`"lfo"`, `"sampleHold"`, `"chaos"`) and the accompanying params (`rate`, `depth`, `wave`, `offset`, `min`, `max`, `center`, `range`, `step`, etc.) matching the schema’s `oneOf`.

### `routing`

Statements like `route <macro> -> <target> <param>` (or the simpler `route <source> -> <target>` from earlier prototypes) produce `routing[]` entries.  
Required schema fields: `from`, `to`, and `param` (enum).  
Include helper syntax to map short keywords (`freq`, `detune`, `gain`, etc.) to schema values.

### `effects`

Use the DSL form `fx <id> <type> <kind> <param> <value> ...` to fill `effects[]`.  
Each schema variant (`filter`, `delay`, `distortion`, `gain`, `compressor`) has required fields; the compiler should expect matching keys (`filterType`, `freq`, `q`, `time`, `feedback`, `amount`, `value`, `threshold`, `ratio`, `attack`, `release`, `knee`, `makeup`).  
Support multiple parameter pairs and coerce them into the appropriate effect object.

### `faust`

A block like `faust module=<name> paramX=<value> ... bypassEffects=true|false` builds the `faust` object in the schema. Parameter names map directly to `params`, with numeric values only.

## Next-up validation targets

Once the parser emits this structure, run AJV against `packages/patches/patch-schema.json`. Use the example payload in the schema as the canonical AST target for the DSL example, mirroring the README’s sample patch to keep behavior consistent with the engine.

By tracking these mappings, we ensure the compiler’s first iteration aligns directly with the JSON schema and the editor’s DSL expectations.
