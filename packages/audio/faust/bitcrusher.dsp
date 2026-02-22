import("stdfaust.lib");

bitDepth = hslider("bitDepth", 4, 1, 16, 1);

// Quantize to N bits
quantize = _ * pow(2, bitDepth) : round : / (pow(2, bitDepth));

process = _,_ : (quantize, quantize);






