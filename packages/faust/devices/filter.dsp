import("stdfaust.lib");

// Simple resonant LP/HP filter
// mode: 0 = lowpass, 1 = highpass

cutoff = hslider("cutoff[style:knob]", 1000.0, 20.0, 20000.0, 0.1) : si.smoo;
q      = hslider("q[style:knob]",      1.0,    0.1,  20.0,    0.001) : si.smoo;
mode   = hslider("mode[style:knob]",   0.0,    0.0,  1.0,     1.0);  // 0=LP, 1=HP

lp = fi.resonlp(cutoff, q, 1.0);
hp = fi.resonhp(cutoff, q, 1.0);

// Crossfade between LP and HP based on mode
process = _ <: (lp, hp) : (*(1.0 - mode), *(mode)) :> _ <: _, _;