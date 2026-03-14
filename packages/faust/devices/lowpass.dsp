import("stdfaust.lib");
import("../lib/flockscript.lib");

// Lowpass filter — resonant one-pole lowpass via Faust filters lib
cutoff = hslider("cutoff[style:knob]", 1000,  20, 20000, 1);
q      = hslider("q[style:knob]",         1, 0.1,    30, 0.01);

process = _ <: fi.resonlp(cutoff, q, 1) <: _, _;
