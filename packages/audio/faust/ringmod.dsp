import("stdfaust.lib");

// Ring Modulator: amplitude modulation with carrier oscillator
// Parameters: carrierFreq, waveform (0=sine, 1=square, 2=saw, 3=tri), wetDry

carrierFreq = hslider("carrierFreq", 440, 20, 5000, 1) : si.smoo;
waveSelect = hslider("waveform", 0, 0, 3, 1);
wetDry = hslider("wetDry", 1.0, 0, 1, 0.01) : si.smoo;

// Carrier oscillator with waveform selection
carrier = os.osc(carrierFreq) * (waveSelect == 0) +
          os.square(carrierFreq) * (waveSelect == 1) +
          os.sawtooth(carrierFreq) * (waveSelect == 2) +
          os.triangle(carrierFreq) * (waveSelect == 3);

// Ring modulator: multiply signal by carrier
ringmod = _ * carrier;

process = _ , _ <: (ringmod, ringmod), (_ , _) : ro.interleave(2,2) : par(i, 2, _ * wetDry + _ * (1 - wetDry));
