import("stdfaust.lib");

// Band-limited oscillator with selectable waveform
// wave: 0=sine, 1=sawtooth, 2=square, 3=triangle, 4=noise
freq = hslider("freq[style:knob]",  440,   20, 20000, 0.01);
gain = hslider("gain[style:knob]",  0.5,    0,     1, 0.001);
wave = hslider("wave[style:knob]",    0,    0,     4, 1);

sine     = os.osc(freq);
sawtooth = os.sawtooth(freq);
square   = os.square(freq);
triangle = os.triangle(freq);
noise    = no.noise;

process = ba.selectn(5, int(wave), sine, sawtooth, square, triangle, noise)
        * gain
        <: _, _;
