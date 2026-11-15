const root = new URL('../vendor/three/', import.meta.url);
export async function resolve(spec, context, next) {
  if (spec === 'three') return { url: new URL('build/three.module.js', root).href, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: new URL('examples/jsm/' + spec.slice('three/addons/'.length), root).href, shortCircuit: true };
  return next(spec, context);
}
