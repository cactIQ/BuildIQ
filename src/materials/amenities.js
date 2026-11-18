// Materials owned by the amenities module (core also loads this file for vegetation).
// Register with M.define(name, async (ctx) => material). Night changes go through uniforms/intensities only.
import * as THREE from 'three';
import { pbr } from './base.js';

/** Fresnel "clear layer" output for water and glass: replaces the standard specular with
 *  F = f0 + (f90 - f0) * (1 - N.V)^5 times the scene environment radiance, keeps sun glints, and blends the diffuse
 *  body with alpha `bodyAlpha` (a GLSL expression of nv). Written so that normal alpha blending gives
 *  body * aB + env * F + glint + (1 - aOut) * background. `prev` = an earlier onBeforeCompile to chain. */
function fresnelLayer(m, { f0, f90, bodyAlpha, key, prev = null }) {
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', [
      '{ float nv = saturate( dot( normal, normalize( vViewPosition ) ) );',
      `  float fF = ${f0.toFixed(3)} + ${(f90 - f0).toFixed(3)} * pow( 1.0 - nv, 5.0 );`,
      `  float aB = ( ${bodyAlpha} ) * ( 1.0 - fF );`,
      '  vec3 glint = reflectedLight.directSpecular;',
      '  vec3 prem = ( totalDiffuse + totalEmissiveRadiance ) * aB + radiance * fF + glint;',
      '  float aO = clamp( aB + fF + dot( glint, vec3( 0.3, 0.5, 0.2 ) ), 0.001, 1.0 );',
      '  outgoingLight = prem / aO; diffuseColor.a = aO; }',
      '#include <opaque_fragment>',
    ].join('\n'));
  };
  m.customProgramCacheKey = () => key;
  return m;
}

export function define(M, SPEC) {
  const T = (ctx, recipe, params) => ctx.tex.get(recipe, params);
  void SPEC;

  /* ------------------------------ pool ------------------------------ */
  // Basin floor + walls: blue mosaic + scrolling caustic emissive (offset animated in update(); cyan boost at night).
  M.define('amenities.poolTile', async (ctx) => {
    const t = await T(ctx, 'mosaic', { color: '#4A8CC4', tile: 1, seed: 31, tint: 0.18 });
    const c = await T(ctx, 'caustics', { size: 512, cells: 6 });
    const m = pbr(t, { roughness: 1 });
    if (c.emissive) { m.emissiveMap = c.emissive; c.emissive.repeat.set(0.5, 0.5); }
    m.emissive = new THREE.Color('#CFF4FF'); m.emissiveIntensity = 0.5;
    return m;
  });
  // Raised kids' pool + jacuzzi outer faces: blue/white mosaic (ref D), no caustics.
  M.define('amenities.mosaicBlue', async (ctx) => pbr(await T(ctx, 'mosaic', { color: '#3C7DC0', tile: 1, seed: 37, tint: 0.28 }), { roughness: 1 }));
  // Main pool coping (off-white) and the beige kids'-pool coping.
  M.define('amenities.coping', async (ctx) => pbr(await T(ctx, 'concrete', { color: '#EEEAE2', seed: 3, rough: 0.6 })));
  M.define('amenities.copingBeige', async (ctx) => pbr(await T(ctx, 'concrete', { color: '#D9C7A4', seed: 13, rough: 0.65 })));

  // Water: deep-blue body (vertex colours: shallow #3FA6D0 at the walls -> deep #1F5FA8), 2 scrolling ripple normals
  // (2x strength), Fresnel env reflection (0.05 facing -> 0.7 grazing), view-dependent transparency (mosaic shows).
  M.define('amenities.water', async (ctx) => {
    const t = await T(ctx, 'waterNormal', { size: 512 });
    const m = new THREE.MeshStandardMaterial({
      color: '#FFFFFF', vertexColors: true, roughness: 0.03, metalness: 0, transparent: true, depthWrite: false,
      normalMap: t.normal, normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 1.0,
      emissive: new THREE.Color('#0A5E74'), emissiveIntensity: 0,
    });
    const uTime = { value: 0 };
    m.userData.uTime = uTime;
    const ripples = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', [
          'vec3 n1 = texture2D( normalMap, vNormalMapUv + vec2( uTime * 0.031, uTime * 0.017 ) ).xyz * 2.0 - 1.0;',
          'vec3 n2 = texture2D( normalMap, vNormalMapUv * 0.57 + vec2( 0.37 - uTime * 0.021, 0.11 + uTime * 0.026 ) ).xyz * 2.0 - 1.0;',
          'vec3 mapN = normalize( vec3( n1.xy + n2.xy, n1.z * n2.z ) );',
        ].join('\n'))
        // longer optical path at grazing angles -> deeper colour (linear #1F5FA8 ~ 0.014, 0.107, 0.392)
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          '{ float nv0 = saturate( dot( normalize( vNormal ), normalize( vViewPosition ) ) );',
          '  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.0137, 0.107, 0.392 ), 0.45 * ( 1.0 - nv0 ) ); }',
        ].join('\n'));
    };
    return fresnelLayer(m, { f0: 0.05, f90: 0.7, bodyAlpha: 'mix( 0.5, 0.9, 1.0 - nv )', key: 'amenities.water.v2', prev: ripples });
  });

  M.define('amenities.grating', async (ctx) => pbr(await T(ctx, 'grating', { tile: 0.5 }), { roughness: 1 }));

  /* ------------------------------ clubhouse ------------------------------ */
  // Body/trim in the tower sand palette (#D8C9AA / #E4D8BC), slightly warm-biased so the blue sky fill on the shaded
  // faces doesn't push them toward green-cream.
  M.define('amenities.clubBody', async (ctx) => pbr(await T(ctx, 'plaster', { color: '#E4C5A8', seed: 17 }), { roughness: 1 }));
  M.define('amenities.clubTrim', async (ctx) => pbr(await T(ctx, 'plaster', { color: '#EDD4B9', seed: 18, variation: 0.03, streaks: 0.02 }), { roughness: 1 }));

  // Sheer curtains 0.3 m behind the glass (opaque, ~25 % darker) + warm interior glow at night (emissiveIntensity).
  M.define('amenities.glazing', async (ctx) => {
    const t = await T(ctx, 'curtain', { size: 512 });
    return new THREE.MeshStandardMaterial({
      // v1.1: white sheers (ref E) - the old taupe read as brown wooden blinds behind the glass
      map: t.albedo, color: '#F4F1EA', roughness: 0.95, metalness: 0, envMapIntensity: 0.6,
      emissiveMap: t.emissive, emissive: new THREE.Color('#FFC890'), emissiveIntensity: 0,
    });
  });
  // Reflective glass layer in front of the curtains: dark tint body, Fresnel env reflection.
  M.define('amenities.glass', async () => {
    const m = new THREE.MeshStandardMaterial({ color: '#2A3036', roughness: 0.02, metalness: 0, transparent: true, depthWrite: false, envMapIntensity: 1.0 });
    return fresnelLayer(m, { f0: 0.1, f90: 0.85, bodyAlpha: '0.16', key: 'amenities.glass.v1' });
  });

  // Gold "CLUB HOUSE" letters: canvas alpha mask on stacked layers (vertex colours darken the back layers -> ~2 cm relief).
  M.define('amenities.letters', async (ctx) => {
    const a = ctx.tex.canvas('amenities.clubLetters2', 1024, 80, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 94px Georgia, "Times New Roman", serif';
      try { g.letterSpacing = '7px'; } catch { /* older canvas */ }
      g.fillText('CLUB HOUSE', w / 2, h / 2 + 5);
    }, { srgb: false });
    // v1.1: brushed brass that reads gold from every angle (metalness 0.8 mirrored the dark ground -> letters looked black)
    return new THREE.MeshStandardMaterial({ color: '#D9A853', roughness: 0.38, metalness: 0.35, alphaMap: a, alphaTest: 0.5, envMapIntensity: 1.2, vertexColors: true,
      emissive: new THREE.Color('#B8862F'), emissiveIntensity: 0.22 });
  });

  M.define('amenities.soil', async (ctx) => pbr(await T(ctx, 'concrete', { color: '#5B4A38', seed: 71, rough: 0.97 })));

  /* ------------------------------ plaza ------------------------------ */
  M.define('amenities.epdm', async (ctx) => pbr(await T(ctx, 'epdm', { size: 1024 })));
  M.define('amenities.play', async () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 }));

  /* ------------------------------ vegetation ------------------------------ */
  // v1.6 low-poly broadleaf trees (owner: replace leaf-card belt trees): faceted, flat-shaded, vertex colours
  // (trunk brown, canopy light-top/dark-base) x per-instance tint. No textures, no alpha.
  M.define('vegetation.lowpoly', async () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.8 }));
  M.define('vegetation.bark',async (ctx) => pbr(await T(ctx, 'palmBark', {}), { roughness: 1 }));
  M.define('vegetation.frond', async (ctx) => {
    const t = await T(ctx, 'palmFrond', {});
    return new THREE.MeshStandardMaterial({
      map: t.albedo, alphaMap: t.alpha, alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide,
      roughness: 0.75, metalness: 0,
    });
  });
  // Leaf cards (trees, shrubs, bougainvillea, hedges): leaf-atlas colour + separate alpha, alphaTest + alpha-to-coverage,
  // vertex colours (AO + sun-side warmth) x instance tint. Card normals are bent outward from the canopy centre in the
  // geometry; the back-face normal flip is removed so both card sides shade like the canopy volume.
  M.define('vegetation.foliage', async (ctx) => {
    const t = await T(ctx, 'leafAtlas', { size: 1024 });
    const m = new THREE.MeshStandardMaterial({
      map: t.albedo, alphaMap: t.alpha, alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide,
      vertexColors: true, roughness: 0.8, metalness: 0, envMapIntensity: 0.9,
    });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace(/normal \*= faceDirection;/, ''));
    };
    m.customProgramCacheKey = () => 'vegetation.foliage.cards.v1';
    return m;
  });
}
