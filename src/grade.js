// Colour grade folded into tone mapping (v1.2): zero extra passes, so it is iGPU-safe (house rule: no composer by default).
// CustomToneMapping = exposure (look) -> blend(Neutral, ACES) -> saturation -> gentle S-curve -> slight warmth -> look.
//   ACES gives punchy, rich mid-tones (the "vibrant" look); Neutral keeps cream facades from sliding to ochre in the
//   highlights. The blend weight is the main dial. Patch once, before anything compiles; select with
//   renderer.toneMapping = THREE.CustomToneMapping (both exterior and interior use it -> no recompile on switch).
//
// v1.13 looks ("LUT" presets, src/spec/looks.js): a live, art-directable grade ON TOP of the base grade.
//   One shared Float32Array (LOOK_U) is injected into every ShaderLib uniform set before anything compiles. three's
//   cloneUniforms copies typed arrays BY REFERENCE, so every material (and the sky, which skips tone mapping and calls
//   applyLook itself) reads the same four numbers: changing a look is a uniform write, never a recompile.
import * as THREE from 'three';

export const GRADE = { aces: 0.55, saturation: 1.1, contrast: 1.06, warmth: 0.01 };   // v1.3: less sat -> no orange cast at night

/** Look parameters. Neutral = the base grade unchanged. */
export const LOOK_NEUTRAL = Object.freeze({ exposure: 1, contrast: 1, vibrance: 0, warmth: 0 });
export const LOOK_RANGE = Object.freeze({ exposure: [0.6, 1.6], contrast: [0.7, 1.4], vibrance: [-0.8, 1], warmth: [-0.08, 0.08] });
const LOOK_KEYS = ['exposure', 'contrast', 'vibrance', 'warmth'];
/** Shared uniform value: [exposure, contrast, vibrance, warmth]. */
export const LOOK_U = new Float32Array([1, 1, 0, 0]);

/** GLSL: the look applied to a display-referred linear colour (identity at neutral, apart from a clamp to [0, 1]). */
export const LOOK_GLSL = /* glsl */`
uniform vec4 uLook;
vec3 applyLook( vec3 c ) {
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	float mx = max( c.r, max( c.g, c.b ) ), mn = min( c.r, min( c.g, c.b ) );
	float s = mx > 1e-4 ? ( mx - mn ) / mx : 0.0;
	c = max( mix( vec3( l ), c, 1.0 + uLook.z * ( 1.0 - s ) ), 0.0 );   // vibrance: boosts muted colours most
	vec3 p = clamp( sqrt( c ), 0.0, 1.0 );
	p = clamp( ( p - 0.5 ) * uLook.y + 0.5, 0.0, 1.0 );                   // contrast around mid-grey (perceptual space)
	c = p * p;
	return c * vec3( 1.0 + uLook.w, 1.0, 1.0 - uLook.w );               // warmth
}`;

/** Clamp a (partial) look to the allowed ranges, filling gaps from neutral. */
export function normalizeLook(l = {}) {
  const out = {};
  for (const k of LOOK_KEYS) {
    const v = Number(l[k]);
    const [lo, hi] = LOOK_RANGE[k];
    out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : LOOK_NEUTRAL[k];
  }
  return out;
}
export function setLook(l) {
  const n = normalizeLook(l);
  LOOK_U[0] = n.exposure; LOOK_U[1] = n.contrast; LOOK_U[2] = n.vibrance; LOOK_U[3] = n.warmth;
  return n;
}
export const getLook = () => ({ exposure: LOOK_U[0], contrast: LOOK_U[1], vibrance: LOOK_U[2], warmth: LOOK_U[3] });
/** Pick a preset by id from SPEC.looks (falls back to the spec default, then neutral). */
export function resolveLook(looks, id) {
  const p = looks?.presets || {};
  return p[id] || p[looks?.default] || LOOK_NEUTRAL;
}

let installed = false;
export function installGrade(g = GRADE) {
  if (installed) return;
  installed = true;
  const f = (x) => Number(x).toFixed(4);
  const fn = /* glsl */`${LOOK_GLSL}
vec3 CustomToneMapping( vec3 color ) {
	color *= uLook.x;
	vec3 c = mix( NeutralToneMapping( color ), ACESFilmicToneMapping( color * 0.6 ), ${f(g.aces)} );
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = max( mix( vec3( l ), c, ${f(g.saturation)} ), 0.0 );
	vec3 p = sqrt( c );
	p = clamp( ( p - 0.5 ) * ${f(g.contrast)} + 0.5, 0.0, 1.0 );
	c = p * p;
	c *= vec3( 1.0 + ${f(g.warmth)}, 1.0, 1.0 - ${f(g.warmth)} );
	return saturate( applyLook( c ) );
}`;
  const src = THREE.ShaderChunk.tonemapping_pars_fragment;
  const stub = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
  if (!src.includes(stub)) { console.warn('[grade] tone-mapping stub not found; using Neutral'); return; }
  THREE.ShaderChunk.tonemapping_pars_fragment = src.replace(stub, fn);
  // every built-in material gets the shared look uniform (cloned by reference, see the header)
  for (const k of Object.keys(THREE.ShaderLib)) { const u = THREE.ShaderLib[k].uniforms; if (u) u.uLook = { value: LOOK_U }; }
}
