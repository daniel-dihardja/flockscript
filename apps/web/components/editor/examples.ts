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
        label: "Syntax draft",
        code: [
          "audio {",
          "  osc osc1 wave=sine frequency=80 gain=0.7",
          "  osc osc2 wave=sine frequency=432 gain=0.03",
          "  output out gain=1",
          "  [osc1, osc2] -> out",
          "}",
          "",
          "sil",
          ""
        ].join("\n"),
      },
    ],
  },
];
