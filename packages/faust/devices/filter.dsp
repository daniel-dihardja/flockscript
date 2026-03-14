import("stdfaust.lib");

// Unified filter — resonant lowpass + highpass
// mode: 0 = lowpass, 1 = highpass
cutoff = hslider("cutoff[style:knob]", 1000, 20, 20000, 1);
q      = hslider("q[style:knob]",         1, 0.1,   30, 0.01);
mode   = hslider("mode[style:knob]",      0,   0,    1, 1);

lp = fi.resonlp(cutoff, q, 1);
hp = fi.resonhp(cutoff, q, 1);

process = _ <: ba.selectn(2, int(mode), lp, hp) <: _, _;
