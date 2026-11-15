// Global conventions. Units: metres, Y-up, +x east, +z south (front road on the south).
// Origin: plot bbox centre; y=0 = finished ground level.
export const global = {
  seed: 20261115,
  units: 'm',
  roadLevel: -0.15,
  // Palette sampled from the references (docs/phase3-review-decisions.md). sRGB hex.
  palette: {
    body: '#D6C6A4',        // inferred: calibrate on compare sheets
    trim: '#E4D8BC',
    ornament: '#D1BF9A',
    frame: '#3B3128',
    glassTint: '#3A332C',
    balconyGlass: '#5A5F66',
    rail: '#D9D9D6',
    slabWhite: '#EEEAE0',
    roofDeck: '#B9C0C4',
    gold: '#C08A3E',
    walnut: '#7A4E33',
    pavers: '#A8A59F',
    asphalt: '#4A4C4F',
    kerb: '#C9C6BE',
    lawn: '#5E8A3A',
    hedge: '#3F6B2A',
    deck: '#D8C0A4',
    mosaic: '#A8CAD9',
    coping: '#F0F0EE',
    water: '#2E9FB5',
    iron: '#1A1A1A',
    gymWall: '#DACDAF',
    gymTile: '#A5A5A0',
    mat: '#4A5564',
  },
  // Time-of-day keyframes (k). All PMREMs are pre-baked at these values.
  timeOfDay: {
    default: 0.35,
    keyframes: [
      // sunAzim: degrees clockwise from north (-z) toward east (+x). skyElev: Preetham sun (may be < 0).
      // night: lights/emissives on; nightDome: night sky overlay opacity.
      { id: 'day',    k: 0.0,  sunElev: 55, sunAzim: 200, skyElev: 55,  sunColor: '#FFF4E6', sunI: 3.2,  envI: 0.85, exposure: 1.0, fog: 0.0022, fogColor: '#C9D3DA', hemi: 0.0,  night: 0,   nightDome: 0 },
      { id: 'golden', k: 0.35, sunElev: 18, sunAzim: 125, skyElev: 14,  sunColor: '#FFB070', sunI: 2.4,  envI: 0.75, exposure: 1.1, fog: 0.0030, fogColor: '#D9C4A8', hemi: 0.0,  night: 0.1, nightDome: 0 },
      { id: 'dusk',   k: 0.65, sunElev: 12, sunAzim: 112, skyElev: 1,   sunColor: '#FF8A50', sunI: 0.9,  envI: 0.55, exposure: 1.3, fog: 0.0035, fogColor: '#8C8796', hemi: 0.05, night: 0.6, nightDome: 0.35 },
      { id: 'night',  k: 1.0,  sunElev: 40, sunAzim: 140, skyElev: -12, sunColor: '#9DB4FF', sunI: 0.15, envI: 0.35, exposure: 1.5, fog: 0.0030, fogColor: '#1E2433', hemi: 0.15, night: 1,   nightDome: 1 },
    ],
    litWindowFraction: 0.55,
    windowWarmK: 2700,
  },
  sky: { turbidity: 9, rayleigh: 1.5, mieCoefficient: 0.005, mieDirectionalG: 0.8 },
  // Known real sizes for the scale validator (asymmetric tolerance: -10% / +5%).
  knownSizes: {
    car: { len: [4.2, 4.9] },
    door: { h: [2.0, 2.4] },
    palm: { h: [5, 10] },
    floor: { h: [2.8, 3.6] },
  },
  grounding: { floatingTol: 0.02, buriedTol: 0.05 },
};
