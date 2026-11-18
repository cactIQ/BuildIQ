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
      // v1.1 outer ring (refs B/C show a built-up suburb, not empty fields): mid-rise blocks at 150-300 m, kept clear
      // of the road bands; merged into the existing context draws (no new draw calls)
      [-170, -10, 22, 16, 5, '#E4DDD0'], [-185, 95, 18, 18, 4, '#DCD5C8'], [-160, -120, 24, 14, 6, '#E9E4DA'], [-230, -78, 20, 16, 7, '#D7DAD6'],
      [160, -10, 20, 16, 5, '#E6DFCF'], [175, 100, 22, 14, 4, '#EFE4CC'], [170, -120, 18, 18, 6, '#D9D3C6'], [240, 20, 24, 16, 7, '#E2D8C6'],
      [-60, -170, 26, 14, 6, '#E9D8C2'], [50, -165, 20, 18, 5, '#DDD6C8'], [140, -200, 22, 16, 7, '#D3DCE0'], [-140, -200, 20, 16, 5, '#E6D3C6'],
      [-20, 190, 22, 14, 4, '#ECE6DA'], [110, 200, 20, 16, 5, '#CDD2CA'], [-120, 210, 18, 16, 4, '#E3E0EF'],
      // distant residential towers (400-650 m) for a skyline behind the hero / elevation / aerial-north views
      [320, -380, 24, 20, 16, '#E4DED2'], [80, -460, 26, 20, 14, '#DDD8CE'], [-200, -430, 22, 22, 18, '#E8E2D6'], [420, -180, 22, 18, 12, '#D8D6CF'],
      [-420, -260, 24, 20, 14, '#E2DCD0'], [480, 20, 20, 20, 12, '#E6E0D4'], [-480, 20, 22, 18, 12, '#DAD5CB'], [200, -540, 20, 18, 16, '#E9E4D9'],
      // companions: towers come in clusters with mid-rise podiums around them (a lone tower in a field reads fake)
      [355, -395, 20, 18, 12, '#D9D4C9'], [300, -340, 26, 14, 6, '#E6E0D2'], [115, -470, 20, 18, 11, '#E3DED3'], [60, -420, 24, 14, 5, '#D8D2C6'],
      [-235, -445, 20, 20, 14, '#DCD6CA'], [-170, -400, 26, 16, 6, '#E6E0D2'], [440, -150, 20, 16, 9, '#E4DED2'], [400, -215, 24, 14, 5, '#DAD4C8'],
      [-445, -225, 20, 18, 10, '#E2DDD2'], [-390, -285, 24, 14, 5, '#D6D1C6'], [505, 55, 20, 18, 9, '#DDD8CE'], [455, -15, 24, 14, 5, '#E7E1D5'],
      [-505, 55, 20, 18, 10, '#E1DBCF'], [-455, -15, 24, 14, 5, '#D9D3C7'], [235, -560, 20, 18, 12, '#DED9CE'], [170, -505, 24, 14, 6, '#E4DED2'],
      [280, 160, 22, 16, 6, '#E2DCD0'], [-300, 150, 22, 16, 6, '#DDD7CB'], [320, -80, 22, 16, 7, '#E6E1D6'], [-320, -110, 22, 16, 7, '#DCD7CC'],
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
