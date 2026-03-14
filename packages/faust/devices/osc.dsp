import("stdfaust.lib");

// ------------------------------------------------------------
// Higher-end style oscillator
// - anti-aliased waveforms
// - smooth parameter changes
// - continuous waveform morphing
// - 3-voice unison
// - optional sub oscillator
// ------------------------------------------------------------

// ---------- controls ----------
freq    = hslider("freq[style:knob][unit:Hz]", 110, 20, 20000, 0.01) : si.smoo;
gain    = hslider("gain[style:knob]", 0.25, 0, 1, 0.001) : si.smoo;
shape   = hslider("shape[style:knob]", 0, 0, 4, 0.001) : si.smoo; // 0=sine ... 4=noise
detune  = hslider("detune[style:knob][unit:cents]", 6, 0, 25, 0.01) : si.smoo;
subAmt  = hslider("sub[style:knob]", 0.15, 0, 1, 0.001) : si.smoo;
noiseLP = hslider("noiseColor[style:knob][unit:Hz]", 12000, 200, 20000, 1) : si.smoo;

// ---------- helpers ----------
clip01(x) = max(0.0, min(1.0, x));
triw(p, x) = clip01(1.0 - abs(x - p));   // triangular crossfade weight
cents2ratio(c) = pow(2.0, c/1200.0);

// 5-way continuous morph
morph5(m, a, b, c, d, e) =
    a*triw(0.0, m) +
    b*triw(1.0, m) +
    c*triw(2.0, m) +
    d*triw(3.0, m) +
    e*triw(4.0, m);

// ---------- waveform generators ----------
sine(f)  = os.osc(f);
saw(f)   = os.polyblep_saw(f);
sqr(f)   = os.polyblep_square(f);
tri(f)   = os.polyblep_triangle(f);

// colored noise so it sits better with tonal waves
nse = no.noise : fi.lowpass(1, noiseLP) * 0.35;

// single oscillator voice
voice(f) = morph5(shape,
    sine(f),
    saw(f),
    sqr(f),
    tri(f),
    nse
);

// 3-voice unison
u1 = voice(freq * cents2ratio(-detune));
u2 = voice(freq);
u3 = voice(freq * cents2ratio(detune));
unison = (u1 + u2 + u3) / 3.0;

// sub oscillator
sub = os.polyblep_square(freq * 0.5) * 0.5 * subAmt;

// final output
out = (unison + sub) * gain * 0.8;

process = out <: _,_;