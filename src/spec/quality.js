// Quality tiers. maxPx caps the drawing buffer regardless of DPR.
export const quality = {
  high: { maxPx: 3.7e6,      // v1.2: up to 2560x1440 / 1.5x DPR sharpness (measured iGPU headroom: 2-5 ms at 2.1 MP)
 shadowMap: 4096, windows: 'interior', anisotropy: 8, palmFronds: 14, treeDetail: 2, pmremSize: 256 },
  low:  { maxPx: 0.9e6, shadowMap: 1024, windows: 'parallax', anisotropy: 4, palmFronds: 10, treeDetail: 1, pmremSize: 128 },
  dynamicRes: { step: 0.1, floor: 0.75, sampleFrames: 60, raiseAfterMs: 3000 },
  targets: { heroFps: 45, aerialFps: 30, lowFps: 30, ttiMs: 5000 },
  budgets: { // high tier, visible + shadow casters
    towers:    { draws: 120, tris: 700000 },
    site:      { draws: 70,  tris: 300000 },
    vegetation:{ draws: 20,  tris: 250000 },
    amenities: { draws: 40,  tris: 150000 },
    total:     { draws: 300, tris: 1500000, programs: 30 },
  },
};
export const embed = { allowedOrigins: [] };
export const i18n = { enabled: ['en'], available: ['en', 'hi', 'mr'], reviewed: { hi: false, mr: false } };
