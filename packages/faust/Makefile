FAUST     = faust
DSP_DIR   = devices
OUT_DIR   = public

# Add a new device name here to include it in the build
DEVICES   = filter eq osc

.PHONY: all clean compile $(DEVICES)

all: $(DEVICES)

$(DEVICES):
	$(FAUST) -lang wasm-ib $(DSP_DIR)/$@.dsp -o $(OUT_DIR)/$@.wasm

# Compile a single DSP file without adding it to DEVICES.
# Useful for iterating on a new device before committing it to the full build.
#
# Usage:
#   make compile DSP=<device-name>
#
# Examples:
#   make compile DSP=hello
#   make compile DSP=bitcrusher
#
# Output: public/<device-name>.wasm  +  public/<device-name>.json
compile:
ifndef DSP
	$(error DSP is not set. Usage: make compile DSP=<device-name>)
endif
	$(FAUST) -lang wasm-ib $(DSP_DIR)/$(DSP).dsp -o $(OUT_DIR)/$(DSP).wasm

clean:
	rm -f $(OUT_DIR)/*.wasm $(OUT_DIR)/*.json
