// Registry validation (pure; runs in node tests and in the browser -> window.__report.grounding).
// Grounding (WorldClaw-style support check): bbox.min.y vs supportY.
// Scale: known categories vs SPEC.global.knownSizes with an asymmetric tolerance (-10% / +5%).

const TOL_LO = 0.10, TOL_HI = 0.05;

export function validateRegistry(registry, SPEC) {
  const g = SPEC.global.grounding, sizes = SPEC.global.knownSizes;
  const floating = [], buried = [], scale = [], nan = [];
  for (const r of registry.items) {
    const mn = r.bbox.min, mx = r.bbox.max;
    if ([...mn, ...mx].some((v) => !Number.isFinite(v))) { nan.push(r.id || r.kind); continue; }
    if (r.supportY !== null && r.supportY !== undefined) {
      const d = mn[1] - r.supportY;
      if (d > g.floatingTol) floating.push({ id: r.id || r.kind, module: r.module, gap: +d.toFixed(3) });
      else if (d < -g.buriedTol) buried.push({ id: r.id || r.kind, module: r.module, depth: +(-d).toFixed(3) });
    }
    const spec = sizes[r.kind];
    if (spec) {
      const dims = { len: Math.max(mx[0] - mn[0], mx[2] - mn[2]), h: mx[1] - mn[1] };
      for (const [key, [lo, hi]] of Object.entries(spec)) {
        const v = dims[key];
        if (v < lo * (1 - TOL_LO) || v > hi * (1 + TOL_HI)) scale.push({ id: r.id || r.kind, kind: r.kind, key, value: +v.toFixed(2), expected: [lo, hi] });
      }
    }
  }
  return { floating, buried, scale, nan, ok: !floating.length && !buried.length && !scale.length && !nan.length, count: registry.items.length };
}
