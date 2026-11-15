// site module (stub). Contract: export async function build(ctx) -> { group, update?(f), onTimeOfDay?(k, state), dispose?() }
// See docs/CONTRACTS.md. Owner: site agent.
export async function build(ctx) {
  const { THREE } = ctx;
  const group = new THREE.Group();
  group.name = 'Module_site';
  return { group };
}
