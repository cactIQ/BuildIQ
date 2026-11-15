// Gym interior module (stub). Built into its own scene; lazy-loaded by core when the 'gym' view is requested.
export async function build(ctx) {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = 'Interior_gym';
  return { group };
}
