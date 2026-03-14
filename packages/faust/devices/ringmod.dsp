import("stdfaust.lib");
import("../lib/flockscript.lib");

// Ring modulator — multiplies input by a carrier sine
carrierFreq = hslider("frequency[style:knob]", 440, 0.01, 20000, 0.01);
depth       = hslider("depth[style:knob]",       1,    0,     1, 0.01);

carrier = os.osc(carrierFreq);
ringmod(x) = x * (1 + depth * (carrier - 1));

process = _ : ringmod <: _, _;
