import("stdfaust.lib");

g = hslider("gain", 1.0, 0.0, 1.0, 0.01);

process = _,_ : *(g),*(g);
