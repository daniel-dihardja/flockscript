import("stdfaust.lib");

cutoff = hslider("cutoff", 800, 100, 5000, 1);

process = _,_ : (fi.lowpass(2, cutoff), fi.lowpass(2, cutoff));
