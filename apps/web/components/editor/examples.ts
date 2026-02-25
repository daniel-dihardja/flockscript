export type Sample = {
  label: string;
  code: string;
};

export type SampleCategory = {
  name: string;
  samples: Sample[];
};

export const SAMPLE_CATEGORIES: SampleCategory[] = [
  {
    name: "Basic",
    samples: [
      {
        label: "Osc variations",
        code: [
          "osc #sine1 sin 220 @0.25",
          "",
          "osc sin 330 @0.2",
          "",
          "osc #square1 sqr 220 @0.22 pan 0.3",
          "",
          "osc #saw1 saw frequency 110 @0.18 detune 8",
          "",
          "osc #triangle1 tri frq 180 @0.2",
          "",
          "osc #modfrq sin frq 110 @0.2",
          "",
          "osc #bass sin 110 @0.3 detune 12",
          "",
          "osc #lead sin 440 @0.16",
          "",
          "osc #plank sin frq 330 @0.2 pan -0.5",
          "",
          "sil",
        ].join("\n"),
      },
    ],
  },
  {
    name: "Modulation Basic",
    samples: [
      {
        label: "Vibrato tone",
        code: [
          "osc #vib sin 220 @0.25",
          "lfo vib-trem sin rate 5 depth 60",
          "route vib-trem -> vib.frq",
        ].join("\n"),
      },
      {
        label: "Gain tremolo",
        code: [
          "osc #trem sin 330 @0.25",
          "lfo tremo sin rate 4 depth 0.2",
          "route tremo -> trem.gain",
        ].join("\n"),
      },
      {
        label: "Noise flutter",
        code: [
          "noi #rustle @0.25",
          "lfo rust-rate sin rate 1 depth 0.3",
          "route rust-rate -> rustle.gain",
        ].join("\n"),
      },
      {
        label: "Pan wobble",
        code: [
          "osc #pan sin 180 @0.2",
          "lfo panwob sin rate 0.5 depth 0.8",
          "route panwob -> pan.pan",
        ].join("\n"),
      },
    ],
  },
  {
    name: "Sequence Basics",
    samples: [
      {
        label: "Basic 4-step kick",
        code: "osc #kick sin 60 @0.35 pan -0.2 env 0.005 0.02 0.6 0.15 seq 1 0 0 0 rate 2 filter lowpass frq 180 q 6",
      },
      {
        label: "Two-note melody",
        code: "osc #lead sin 220 @0.2 pan 0.3 env 0.002 0.05 0.7 0.2 seq 1 0 1 0 rate 1 filter lowpass frq 800 q 2",
      },
      {
        label: "Noise gate sequence",
        code: "osc #gate square 330 @0.15 pan 0 env 0.001 0.05 0.8 0.1 seq 1 0 1 0 1 0 1 0 rate 3",
      },
    ],
  },
];
