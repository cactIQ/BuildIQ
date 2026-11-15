// Materials owned by the amenities module (core also loads this file for vegetation).
// Register with M.define(name, async (ctx) => material). Night changes go through uniforms/intensities only.
import * as THREE from 'three';
import { pbr } from './base.js';

export function define(M, SPEC) {
  const P = SPEC.global.palette;
  const T = (ctx, recipe, params) => ctx.tex.get(recipe, params);

  /* ------------------------------ pool ------------------------------ */
  // Basin floor + walls: mosaic + scrolling caustic emissive (offset animated in update(); cyan boost at night).
  M.define('amenities.poolTile', async (ctx) => {
    const t = await T(ctx, 'mosaic', { color: '#4A8CC4', tile: 1, seed: 31, tint: 0.18 });
    const c = await T(ctx, 'caustics', { size: 512, cells: 6 });
    const m = pbr(t, { roughness: 1 });
    if (c.emissive) { m.emissiveMap = c.emissive; c.emissive.repeat.set(0.5, 0.5); }
    m.emissive = new THREE.Color('#CFF4FF'); m.emissiveIntensity = 0.16;
    return m;
  });

  // Water: Standard, transparent, Fresnel opacity + 2 scrolling normal samples (onBeforeCompile). Env from scene PMREM.
  M.define('amenities.water', async (ctx) => {
    const t = await T(ctx, 'waterNormal', { size: 512 });
    const m = new THREE.MeshStandardMaterial({
      color: P.water, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false,
      normalMap: t.normal, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.8,
      emissive: new THREE.Color('#0A5E74'), emissiveIntensity: 0,
    });
    const uTime = { value: 0 };
    m.userData.uTime = uTime;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', [
          'vec3 n1 = texture2D( normalMap, vNormalMapUv + vec2( uTime * 0.031, uTime * 0.017 ) ).xyz * 2.0 - 1.0;',
          'vec3 n2 = texture2D( normalMap, vNormalMapUv * 0.57 + vec2( 0.37 - uTime * 0.021, 0.11 + uTime * 0.026 ) ).xyz * 2.0 - 1.0;',
          'vec3 mapN = normalize( vec3( n1.xy + n2.xy, n1.z * n2.z ) );',
        ].join('\n'))
        .replace('#include <opaque_fragment>', [
          '{ float wFres = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 4.0 );',
          '  diffuseColor.a = mix( opacity, 0.9, wFres ); }',
          '#include <opaque_fragment>',
        ].join('\n'));
    };
    m.customProgramCacheKey = () => 'amenities.water.v1';
    return m;
  });

  M.define('amenities.grating', async (ctx) => pbr(await T(ctx, 'grating', { tile: 0.5 }), { roughness: 1 }));

  /* ------------------------------ clubhouse ------------------------------ */
  // Reflective glass with sheer curtains behind it: one opaque low-roughness material whose colour/emissive maps are
  // the curtain image (no transparency sorting, one draw). Warm interior glow at night via emissiveIntensity.
  M.define('amenities.glazing', async (ctx) => {
    const t = await T(ctx, 'curtain', { size: 512 });
    return new THREE.MeshStandardMaterial({
      map: t.albedo, color: '#C9CDD0', roughness: 0.05, metalness: 0.05, envMapIntensity: 1.6,
      emissiveMap: t.emissive, emissive: new THREE.Color('#FFC890'), emissiveIntensity: 0,
    });
  });

  // Gold "CLUB HOUSE" letters: gold metal with a canvas alpha mask (letters white on black).
  M.define('amenities.letters', async (ctx) => {
    const a = ctx.tex.canvas('amenities.clubLetters', 1024, 96, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 78px Georgia, "Times New Roman", serif';
      try { g.letterSpacing = '6px'; } catch { /* older canvas */ }
      g.fillText('CLUB HOUSE', w / 2, h / 2 + 4);
    }, { srgb: false });
    return new THREE.MeshStandardMaterial({ color: P.gold, roughness: 0.28, metalness: 1, alphaMap: a, alphaTest: 0.5, envMapIntensity: 1.4 });
  });

  M.define('amenities.soil', async (ctx) => pbr(await T(ctx, 'concrete', { color: '#5B4A38', seed: 71, rough: 0.97 })));

  /* ------------------------------ plaza ------------------------------ */
  M.define('amenities.epdm', async (ctx) => pbr(await T(ctx, 'epdm', { size: 1024 })));
  M.define('amenities.play', async () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 }));

  /* ------------------------------ vegetation ------------------------------ */
  M.define('vegetation.bark', async (ctx) => pbr(await T(ctx, 'palmBark', {}), { roughness: 1 }));
  M.define('vegetation.frond', async (ctx) => {
    const t = await T(ctx, 'palmFrond', {});
    return new THREE.MeshStandardMaterial({
      map: t.albedo, alphaMap: t.alpha, alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide,
      roughness: 0.75, metalness: 0,
    });
  });
  // Clumped foliage (shrubs, hedges, tree clumps): neutral leaf texture x vertex-colour hue/AO x instance tint.
  M.define('vegetation.foliage', async (ctx) => {
    const t = await T(ctx, 'foliage', {});
    return pbr(t, { roughness: 1, vertexColors: true });
  });
}
