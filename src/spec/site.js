// Site layout ("layout map"). Rectangles are {x:[min,max], z:[min,max]}; circles {c:[x,z], r}.
// All values inferred from refs B/C/A (fidelity review), tolerance about 5 m.
export const site = {
  plot: { x: [-57.5, 57.5], z: [-41.5, 41.5] },             // inferred; real plot is irregular (v2)
  world: { x: [-1400, 1400], z: [-1400, 1400] },                // ground extent incl. context
  roads: [
    { id: 'frontRoad', x: [-1400, 1400], z: [43.5, 53.5], lanes: 2, centreline: 'dashed' },
    { id: 'northRoad', x: [-1400, 1400], z: [-51.5, -41.5], lanes: 2, centreline: 'dashed' },
  ],
  footpaths: [
    { id: 'frontFpN', x: [-1400, 1400], z: [41.5, 43.5] },
    { id: 'frontFpS', x: [-1400, 1400], z: [53.5, 55.5] },
    { id: 'northFpS', x: [-1400, 1400], z: [-41.5, -39.5], outsidePlot: false },
    { id: 'northFpN', x: [-1400, 1400], z: [-53.5, -51.5] },
  ],
  zebras: [
    { id: 'zebraW', road: 'frontRoad', x: -26, width: 4 },
    { id: 'zebraE', road: 'frontRoad', x: 60, width: 4 },
  ],
  gates: [
    { id: 'gateW', c: [-15.5, 39.5], w: 12, d: 4, apex: 7.4, soffit: 5.5, clear: 5.8, pedimentPitchDeg: 15 },
    { id: 'gateE', c: [20.5, 39.5], w: 12, d: 4, apex: 7.4, soffit: 5.5, clear: 5.8, pedimentPitchDeg: 15 },
  ],
  wall: {
    front: { pierSize: 0.5, pierH: 1.5, spacing: 2.5, plinthH: 0.6, infill: 'rails' },
    sides: { pierSize: 0.5, pierH: 1.8, spacing: 2.5, plinthH: 0.4, infill: 'bars' },
  },
  paving: [ // grey pavers; everything inside the plot not otherwise assigned is paved apron
    { id: 'apron', x: [-57.5, 57.5], z: [-41.5, 41.5] },
  ],
  parking: [
    { id: 'westParking', x: [-55, -46], z: [-30, 10], stalls: 'perpendicular' },
  ],
  pool: {
    deck: { x: [-40, -22], z: [28, 40.5] },
    basin: { c: [-31, 34], w: 12, d: 6.5, depth: 1.4 },
    kids: { c: [-31, 37.25], w: 3, d: 3, raise: 0.45 },   // raised square feature on the south long edge
    jacuzzi: { c: [-36, 31.5], r: 1.1, raise: 0.45 },
    ladders: [{ x: -26.5, edge: 'north' }, { x: -35.5, edge: 'south' }],
    westWall: { x: -40, h: 1.1 },
  },
  clubhouse: { c: [-33, 23], w: 9, d: 9, wallH: 3.3, entabTop: 4.7, parapetTop: 5.6, attic: 'stepped' },
  plaza: {
    area: { x: [24, 57], z: [-41, 41] },
    treeRing: { c: [42, 2], r: 4 },
    lawn: { c: [40, -27], w: 20, d: 12, ends: 'rounded', striped: true },
    play: { c: [42, 31], r: 5, surface: 'epdm-multicolour' },
    lawnStripSouth: { x: [24, 57], z: [39, 41] },
  },
  context: {
    // simple neighbours: [x, z, w, d, floors, colour]
    buildings: [
      [-95, 15, 18, 14, 4, '#E9E4DA'], [-90, -20, 16, 16, 3, '#D8D2C4'], [-100, -75, 20, 14, 4, '#E6DFCF'],
      [85, -70, 14, 12, 2, '#F2F0EA'], [95, 10, 18, 14, 4, '#DDD6C8'], [100, 85, 16, 14, 3, '#E9E4DA'],
      // south-side neighbours sit behind the elevation camera (z > 115) so the ref-A sightline across the road is clear
      [-70, 135, 20, 14, 4, '#D9D3C6'], [10, 140, 18, 16, 3, '#E4DDD0'], [80, 130, 16, 12, 4, '#CFCBC2'],
      [-30, -80, 22, 14, 4, '#E7E1D4'], [30, -85, 16, 14, 3, '#D6D0C2'],
    ],
    treeBelts: [
      { x: [-140, -62], z: [-35, 35], density: 0.012 },
      { x: [62, 140], z: [-35, 60], density: 0.012 },
      { x: [-140, -45], z: [62, 140], density: 0.008 },      // south belt split: clear corridor x[-45,60]
      { x: [60, 140], z: [62, 140], density: 0.008 },
      { x: [-140, 140], z: [-140, -60], density: 0.008 },
    ],
    farTreeline: { radius: 950, height: 24 },               // core: far silhouette ring (1 draw) for a real horizon
  },
};
