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
    roofDeck: '#9C9C98',     // neutral grey (critic AER-005)
    gold: '#C08A3E',
    walnut: '#7A4E33',
    pavers: '#A8A59F',
    asphalt: '#4A4C4F',
    kerb: '#C9C6BE',
    lawn: '#4F9A34',         // v1.2: fresher, more saturated greens
    hedge: '#2F7A2A',
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
      // day sun from SSE so the south + east faces (seen by hero, elevation, pool, clubhouse, aerial) are sunlit;
      // reduced sky IBL (blue) + warm sun keep the cream render from going grey-green (round-1 critique)
      // v1.1 "clean air": fog densities cut to ~1/3 and coloured to each keyframe's own horizon (no grey smog band);
      // sky = art-directed gradient (src/sky.js), authored in display sRGB. farTree: far treeline tint (unlit ring).
      // v1.2 "vibrant": strong warm key vs lower IBL fill (crisp shadows), hemisphere fill with a green lawn bounce,
      // graded tone curve (src/grade.js). hemiSky/hemiGround: hemisphere colours per keyframe.
      { id: 'day',    k: 0.0,  sunElev: 52, sunAzim: 155, skyElev: 52,  sunColor: '#FFEBD0', sunI: 4.4,  envI: 0.48, exposure: 0.95, fog: 0.0004, fogColor: '#C4E0F2', hemi: 0.35, hemiSky: '#D4E8FF', hemiGround: '#8FA861', night: 0,   nightDome: 0,
        sky: { zenith: '#2C70D4', horizon: '#A9D5F0', haze: '#D3EAF7', ground: '#9DB8A2', glowColor: '#FFF4E0', hazeAmt: 0.5, glow: 0.22, disc: 6, stars: 0, moon: 0 }, farTree: '#6F9478', cloud: '#FFFFFF', cloudA: 0.6 },
      // v1.6 golden: ~15 % softer key and exposure, less saturated sun (owner: "adjust intensity a bit")
      { id: 'golden', k: 0.35, sunElev: 18, sunAzim: 105, skyElev: 14,  sunColor: '#FFD0A2', sunI: 3.3,  envI: 0.45, exposure: 0.97, fog: 0.00045, fogColor: '#EDD3BC', hemi: 0.3,  hemiSky: '#BCC6E6', hemiGround: '#7D7A4C', night: 0.1, nightDome: 0,
        sky: { zenith: '#3868B8', horizon: '#F8D6B2', haze: '#FBCDA4', ground: '#B8A486', glowColor: '#FFC088', hazeAmt: 0.65, glow: 0.5, disc: 6, stars: 0, moon: 0 }, farTree: '#8C8F70', cloud: '#FFE6CC', cloudA: 0.6 },
      // v1.6 dusk = natural sunset (owner reference): violet upper sky -> magenta-pink -> orange-gold horizon band,
      // violet-lit clouds, a low warm-pink key grazing the facades, lavender sky fill, mauve aerial haze
      { id: 'dusk',   k: 0.65, sunElev: 12, sunAzim: 112, skyElev: 1,   sunColor: '#FFB984', sunI: 0.85, envI: 0.7, exposure: 1.25, fog: 0.0005, fogColor: '#867F8E', hemi: 0.4, hemiSky: '#8F98BC', hemiGround: '#3A3532', night: 0.6, nightDome: 0.35,
        sky: { zenith: '#3A3C8E', mid: '#B4639E', horizon: '#FF9A55', haze: '#FFB063', ground: '#3A3048', glowColor: '#FF8A48', hazeAmt: 0.75, glow: 0.55, disc: 2, stars: 0.1, moon: 0 }, farTree: '#3A2E4A', cloud: '#9A6CA8', cloudA: 0.75 },
      // night = clear moonlit blue hour: deep navy zenith, cobalt horizon, stars + a visible moon; the key light swings to
      // the moon (timeOfDay.moon) and the facade accent lighting + lit windows carry the image
      { id: 'night',  k: 1.0,  sunElev: 40, sunAzim: 140, skyElev: -12, sunColor: '#B4C8F2', sunI: 0.3, envI: 0.9, exposure: 1.6, fog: 0.00045, fogColor: '#13203D', hemi: 0.5, hemiSky: '#4A64A6', hemiGround: '#1A2030', night: 1,   nightDome: 1,
        sky: { zenith: '#040B1E', horizon: '#18305C', haze: '#22406E', ground: '#0B1222', glowColor: '#3A4E7A', hazeAmt: 0.6, glow: 0.08, disc: 0.6, stars: 1, moon: 1 }, farTree: '#101A2C', cloud: '#27324A', cloudA: 0.22 },
    ],
    // v1.2 moon: `azim/elev` = moonlight direction (front-left of the hero/elevation views so facades catch cool light,
    // not a black backlit silhouette); `disc` = where the visible moon is drawn (in frame for hero/elevation; archviz cheat)
    moon: { azim: 215, elev: 34, disc: { azim: 50, elev: 6 } },
    litWindowFraction: 0.55,
    windowWarmK: 2700,
  },
  // legacy Preetham parameters (v1.0). v1.1 renders the sky from the per-keyframe `sky` blocks via src/sky.js.
  sky: { turbidity: 4.5, rayleigh: 2.2, mieCoefficient: 0.004, mieDirectionalG: 0.8 },
  // Known real sizes for the scale validator (asymmetric tolerance: -10% / +5%).
  knownSizes: {
    car: { len: [4.2, 4.9] },
    door: { h: [2.0, 2.4] },
    palm: { h: [5, 10] },
    floor: { h: [2.8, 3.6] },
  },
  grounding: { floatingTol: 0.02, buriedTol: 0.05 },
};
