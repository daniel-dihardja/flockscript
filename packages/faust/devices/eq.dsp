import("stdfaust.lib");

lowFreq  = hslider("lowFreq[style:knob]",   200,  20, 20000, 1);
lowGain  = hslider("lowGain[style:knob]",     0, -24,    24, 0.1);
midFreq  = hslider("midFreq[style:knob]",  1000,  20, 20000, 1);
midGain  = hslider("midGain[style:knob]",     0, -24,    24, 0.1);
midQ     = hslider("midQ[style:knob]",       1.0, 0.1,  30, 0.01);
highFreq = hslider("highFreq[style:knob]", 4000,  20, 20000, 1);
highGain = hslider("highGain[style:knob]",    0, -24,    24, 0.1);

process = fi.low_shelf(lowGain, lowFreq)
        : fi.peak_eq(midGain, midFreq, midQ)
        : fi.high_shelf(highGain, highFreq)
        <: _, _;
