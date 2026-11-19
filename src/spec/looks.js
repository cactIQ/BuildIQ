// v1.13 looks: named colour grades ("LUT" presets) applied live on top of the base grade (src/grade.js).
// Pure data. Each look: exposure (brightness, 1 = as authored), contrast (1 = as authored), vibrance (0 = as authored;
// boosts muted colours more than saturated ones), warmth (0 = neutral; + amber, - blue). Ranges: LOOK_RANGE in grade.js.
//
// To make a look the default for everyone: tune it in the browser (?tune=1, or press L), click "Copy template",
// paste the line into `presets` below and set `default` to its id. `?look=<id>` previews any preset by URL.
// A new project reuses this file as is: the looks are scene-independent.
export const looks = {
  default: 'natural',
  presets: {
    natural: { label: 'Natural', exposure: 1, contrast: 1, vibrance: 0, warmth: 0 },
    vivid: { label: 'Vivid', exposure: 1.03, contrast: 1.08, vibrance: 0.45, warmth: 0.01 },
    airy: { label: 'Bright & airy', exposure: 1.14, contrast: 0.93, vibrance: 0.15, warmth: 0 },
    warm: { label: 'Warm', exposure: 1.02, contrast: 1.04, vibrance: 0.2, warmth: 0.035 },
    crisp: { label: 'Crisp & cool', exposure: 1.02, contrast: 1.1, vibrance: 0.15, warmth: -0.03 },
    soft: { label: 'Soft', exposure: 1.05, contrast: 0.88, vibrance: -0.15, warmth: 0.01 },
  },
};
