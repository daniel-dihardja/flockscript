import("stdfaust.lib");
import("../lib/flockscript.lib");

// Reverb — Freeverb stereo plate reverb
roomSize  = hslider("roomSize[style:knob]",  0.5,  0, 1, 0.01);
damping   = hslider("damping[style:knob]",   0.5,  0, 1, 0.01);
wet       = hslider("wet[style:knob]",       0.3,  0, 1, 0.01);
dry       = 1 - wet;

process = _, _ : re.stereoize(re.mono_freeverb(roomSize, damping, wet, dry));
