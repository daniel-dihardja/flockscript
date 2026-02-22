import("stdfaust.lib");

// Simple stereo reverb based on Freeverb
// Parameters: roomSize, damping, wetDry

roomSize = hslider("roomSize", 0.5, 0.1, 1.0, 0.01) : si.smoo;
damping = hslider("damping", 0.5, 0, 1, 0.01) : si.smoo;
wetDry = hslider("wetDry", 0.5, 0, 1, 0.01) : si.smoo;

// Stereo reverb: sum inputs to mono, process through reverb, mix with dry
process = _ , _ : + : re.mono_freeverb(damping, roomSize, 0.5, 0) <: _ , _ : par(i, 2, _ * wetDry) :> _ , _ <: _ + (_ : *(-1)), _ + (_ : *(1)) : par(i, 2, _ * 0.5);

