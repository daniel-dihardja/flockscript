import("stdfaust.lib");

hpFreq   = hslider("hpFreq[style:knob]",      30,  20,   400, 1);
lowFreq  = hslider("lowFreq[style:knob]",     100,  20, 20000, 1);
lowGain  = hslider("lowGain[style:knob]",     4.0, -24,    24, 0.1);
midFreq  = hslider("midFreq[style:knob]",     350,  20, 20000, 1);
midGain  = hslider("midGain[style:knob]",    -3.0, -24,    24, 0.1);
midQ     = hslider("midQ[style:knob]",        0.7, 0.1,    30, 0.01);
highFreq = hslider("highFreq[style:knob]",   5000,  20, 20000, 1);
highGain = hslider("highGain[style:knob]",   -6.0, -24,    24, 0.1);

process = fi.highpass(2, hpFreq)
        : fi.low_shelf(lowGain, lowFreq)
        : fi.peak_eq(midGain, midFreq, midQ)
        : fi.high_shelf(highGain, highFreq)
        <: _, _;
