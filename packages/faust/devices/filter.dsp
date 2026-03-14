import("stdfaust.lib");

// High-end analog-style resonant filter
// 4-pole (24 dB/oct), input drive + tanh saturation,
// resonance gain compensation, subtle noise floor
// mode: 0 = lowpass, 1 = bandpass, 2 = highpass

cutoff = hslider("cutoff[style:knob]", 1000.0, 20.0, 20000.0, 0.1) : si.smoo;
q      = hslider("q[style:knob]",      1.0,    0.1,  20.0,    0.001) : si.smoo;
drive  = hslider("drive[style:knob]",  1.0,    1.0,  8.0,     0.01)  : si.smoo;
mode   = hslider("mode[style:knob]",   0.0,    0.0,  2.0,     1.0)   : si.smoo; // 0=LP, 1=BP, 2=HP

// Soft saturation — the core of analog warmth
saturate(x) = ma.tanh(x);

// 4-pole LP: two cascaded 2-pole stages with drive/sat between them
// sqrt(q) distributes resonance evenly so the knob still feels natural
lp4 = *(drive) : saturate
    : fi.resonlp(cutoff, sqrt(q), 1.0)
    : saturate
    : fi.resonlp(cutoff, sqrt(q), 1.0)
    : /(drive);

// Bandpass: single 2-pole stage, half Q to match perceived width
bp2 = *(drive) : saturate
    : fi.resonbp(cutoff, q * 0.5, 1.0)
    : /(drive);

// 4-pole HP: two cascaded 2-pole stages
hp4 = *(drive) : saturate
    : fi.resonhp(cutoff, sqrt(q), 1.0)
    : saturate
    : fi.resonhp(cutoff, sqrt(q), 1.0)
    : /(drive);

// Resonance gain compensation: high Q thins the low end — counteract that
resonComp = 1.0 + (q / 20.0) * 0.5;

// Discrete mode selection via smooth crossfades between three outputs
// mode < 0.5 → LP↔BP blend, mode > 1.5 → BP↔HP blend
lpAmt  = max(0.0, 1.0 - mode);
bpAmt  = 1.0 - abs(mode - 1.0);
hpAmt  = max(0.0, mode - 1.0);

filterBank(x) = lp4(x) * lpAmt + bp2(x) * bpAmt + hp4(x) * hpAmt;

// Subtle analog noise floor (adds life without colouring the signal)
noise = no.noise * 0.0001;

process = (+ (noise)) : *(resonComp) : filterBank <: _, _;