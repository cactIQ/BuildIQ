// Colour grade folded into tone mapping (v1.2): zero extra passes, so it is iGPU-safe (house rule: no composer by default).
// CustomToneMapping = blend(Neutral, ACES) -> saturation -> gentle S-curve -> slight warmth.
//   ACES gives punchy, rich mid-tones (the "vibrant" look); Neutral keeps cream facades from sliding to ochre in the
//   highlights. The blend weight is the main dial. Patch once, before anything compiles; select with
//   renderer.toneMapping = THREE.CustomToneMapping (both exterior and interior use it -> no recompile on switch).
import * as THREE from 'three';

export const GRADE = { aces: 0.55, saturation: 1.1, contrast: 1.06, warmth: 0.01 };   // v1.3: less sat -> no orange cast at night

let installed = false;
export function installGrade(g = GRADE) {
  if (installed) return;
  installed = true;
  const f = (x) => Number(x).toFixed(4);
  const fn = /* glsl */`vec3 CustomToneMapping( vec3 color ) {
	vec3 c = mix( NeutralToneMapping( color ), ACESFilmicToneMapping( color * 0.6 ), ${f(g.aces)} );
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = max( mix( vec3( l ), c, ${f(g.saturation)} ), 0.0 );
	vec3 p = sqrt( c );
	p = clamp( ( p - 0.5 ) * ${f(g.contrast)} + 0.5, 0.0, 1.0 );
	c = p * p;
	c *= vec3( 1.0 + ${f(g.warmth)}, 1.0, 1.0 - ${f(g.warmth)} );
	return saturate( c );
}`;
  const src = THREE.ShaderChunk.tonemapping_pars_fragment;
  const stub = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
  if (!src.includes(stub)) { console.warn('[grade] tone-mapping stub not found; using Neutral'); return; }
  THREE.ShaderChunk.tonemapping_pars_fragment = src.replace(stub, fn);
}
