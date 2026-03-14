import("stdfaust.lib");
import("../lib/flockscript.lib");

// Bitcrusher — reduces bit depth and sample rate for lo-fi distortion
bits   = hslider("bits[style:knob]",   8,  1, 24, 1);
rate   = hslider("rate[style:knob]",   1,  1, 64, 1);
gain   = hslider("gain[style:knob]", 0.8,  0,  1, 0.01);

crush(b, x) = floor(x * steps + 0.5) / steps
  with { steps = pow(2, b - 1); };

downSample(r, x) = ba.sAndH(ba.pulse(r), x);

process = _ : downSample(rate) : crush(bits) : *(gain) <: _, _;
