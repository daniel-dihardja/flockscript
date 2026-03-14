import("stdfaust.lib");
import("../lib/flockscript.lib");

// Gain — simple stereo gain stage
gain = hslider("gain[style:knob]", 0.5, 0, 1, 0.01);

process = stereoGain(gain);
