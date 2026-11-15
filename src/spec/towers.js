// Tower definitions (inferred from refs A/B/C; see docs/phase3-review-decisions.md).
// Building local frame: origin at base centre, front facade faces +z. Floors indexed 1..floors; 0 = stilt.
const heroFront = [ // left -> right, metres
  { type: 'wing', w: 7.1, project: 0.3, windows: 2, winW: 1.5, winH: 1.7 },
  { type: 'small', w: 2.7, winW: 1.3, winH: 1.7 },
  { type: 'balcony', w: 3.1 },
  { type: 'strip', w: 2.0, winW: 1.5, winH: 2.1 },
  { type: 'balcony', w: 3.1 },
  { type: 'small', w: 2.7, winW: 1.3, winH: 1.7 },
  { type: 'wing', w: 7.1, project: 0.3, windows: 2, winW: 1.5, winH: 1.7 },
];
const rearModule = [ // compressed module; two modules make the 46 m south face (inferred)
  { type: 'wing', w: 5.6, project: 0.3, windows: 2, winW: 1.3, winH: 1.7 },
  { type: 'small', w: 2.3, winW: 1.2, winH: 1.7 },
  { type: 'balcony', w: 2.8 },
  { type: 'strip', w: 1.6, winW: 1.2, winH: 2.1 },
  { type: 'balcony', w: 2.8 },
  { type: 'small', w: 2.3, winW: 1.2, winH: 1.7 },
  { type: 'wing', w: 5.6, project: 0.3, windows: 2, winW: 1.3, winH: 1.7 },
];

const common = {
  floors: 14, floorH: 3.0, stiltH: 3.5, plinthH: 0.3,
  cornices: [0, 3, 4, 7, 8, 12, 14],     // heavy cornice at the TOP of these floor indices
  bandFloors: [4, 8],                     // floors sandwiched between cornices (no relief panels)
  orderFloors: [13, 14],                  // two-storey order with round engaged columns
  slabBand: { h: 0.22, project: 0.06 },
  cornice: { h: 0.55, project: 0.45, bevel: 0.02 },
  pilaster: { w: 0.45, project: 0.12 },
  attic: { bandH: 2.5, archWindows: 3, pedimentH: 2.0, pedimentPitchDeg: 15, thickness: 0.4, returnDepth: 1.5 },
  parapetH: 1.1,
  stiltGrid: 6.0, stiltCol: 0.45,
  sides: {
    W: { pattern: 'plain', windowStacks: 2 },
    E: { pattern: 'plain', windowStacks: 2 },
    N: { pattern: 'balconies' },
  },
};

export const towers = [
  {
    id: 'Tower_H', label: 'Tower A', role: 'hero',
    c: [2.5, 20], w: 28, d: 23, rotY: 0, ...common,
    front: heroFront,
    openLoggias: [{ side: 'L', floors: [8, 13, 14] }],     // inferred, medium confidence
    mumty: { tiers: 2, w: 5, d: 6, h1: 3.2, h2: 2.0, over: 'strip' },
    roof: { extraMumties: 2, sunkenPlanters: 2, perimeterHedge: true, shaft: null },
  },
  {
    id: 'Tower_R', label: 'Tower B', role: 'rear',
    c: [-22.5, -18.2], w: 46, d: 20, rotY: 0, ...common,
    front: [...rearModule, ...rearModule],
    openLoggias: [],
    mumty: { tiers: 2, w: 4.5, d: 5.5, h1: 3.2, h2: 2.0, over: 'strip' },
    roof: { extraMumties: 4, sunkenPlanters: 3, perimeterHedge: true, shaft: { w: 12, d: 4 } },
  },
];

export const towerHeight = (t) => t.stiltH + t.floors * t.floorH;  // top of floor 14 slab (excl. parapet/attic)
