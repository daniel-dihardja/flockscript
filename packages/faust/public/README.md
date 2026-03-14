# public/

Compiled Faust WebAssembly artifacts. **Do not edit these files by hand.**

Each device is represented by two files:

| File            | Description                                      |
| --------------- | ------------------------------------------------ |
| `<device>.wasm` | Compiled DSP binary loaded at runtime            |
| `<device>.json` | Parameter metadata (UI labels, ranges, defaults) |

To recompile a single device:

```sh
make compile DSP=<device-name>
```

To recompile all devices:

```sh
make all
```

Source `.dsp` files live in `../devices/`. Shared DSP utilities live in `../lib/`.
