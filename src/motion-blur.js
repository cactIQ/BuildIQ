// v1.16 camera motion blur (owner tool, opt-in, default off; house rule: no composer by default).
// When enabled AND the camera moved since the last frame, the scene renders into a HalfFloat MSAA render target with
// a depth texture, and one fullscreen pass smears each pixel along its screen velocity. The velocity comes from the
// depth: world position = inverse(current view-projection) * pixel, then projected with LAST frame's view-projection.
// Camera blur only (moving water, people, etc. are not tracked), which is what a camera flight needs.
//
// Same image as the direct path: the target is flagged `isXRRenderTarget` with an sRGB-tagged float texture, so three
// r170 runs every material exactly as for the canvas (CustomToneMapping grade + look, sRGB encode, and fog mixed after
// the encode; a Linear target was tried and made distant fog visibly hazier). The pass averages display-encoded
// values and writes them out unchanged. A static camera renders straight to the canvas: no cost, identical frames.
//
// Programs: with tone mapping and output colour space unchanged, scene materials reuse their canvas programs; only
// the blur pass is new. `prepare(scene, camera)` still runs compileAsync for the target (core pauses its "new program
// after ready" warning around it). Until a scene is prepared, frames render directly (no hitch).

const FRAG = /* glsl */`
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform mat4 uInvVP;
uniform mat4 uPrevVP;
uniform float uScale;
uniform float uMaxLen;
varying vec2 vUv;
const int TAPS = 12;
void main() {
	float d = texture2D( tDepth, vUv ).x;
	vec4 w = uInvVP * vec4( vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
	w /= w.w;
	vec4 p = uPrevVP * w;
	vec2 prevUv = p.w > 0.0 ? p.xy / p.w * 0.5 + 0.5 : vUv;
	vec2 vel = ( vUv - prevUv ) * uScale;
	float len = length( vel );
	if ( len > uMaxLen ) vel *= uMaxLen / len;
	// interleaved gradient noise jitters the taps: smooth streaks instead of 12 stepped copies
	float j = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
	vec4 acc = vec4( 0.0 );
	for ( int i = 0; i < TAPS; i ++ ) {
		float t = ( float( i ) + j ) / float( TAPS ) - 0.5;
		acc += texture2D( tColor, vUv + vel * t );
	}
	gl_FragColor = vec4( acc.rgb / float( TAPS ), 1.0 );   // already display-encoded: no colorspace_fragment
}`;

/**
 * @param {{THREE, renderer, samples?: number}} o
 * @returns {{ render(scene, camera, dt): void, prepare(scene, camera): Promise<void>, setEnabled(on): void,
 *   enabled(): boolean, setShutter(deg): void, shutter(): number, reset(): void, dispose(): void }}
 */
export function createMotionBlur({ THREE, renderer, samples = 4 }) {
  let on = false, shutterDeg = 180, havePrev = false, rt = null;
  const prepared = new WeakSet();
  const cur = new THREE.Matrix4(), prev = new THREE.Matrix4(), inv = new THREE.Matrix4();
  const size = new THREE.Vector2();
  // created at boot (house rule: materials at build); its program compiles on first prepare()
  const mat = new THREE.ShaderMaterial({
    name: 'MotionBlur',
    uniforms: { tColor: { value: null }, tDepth: { value: null }, uInvVP: { value: inv }, uPrevVP: { value: prev }, uScale: { value: 0.5 }, uMaxLen: { value: 0.05 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
    fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function target() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, Math.floor(size.x)), h = Math.max(1, Math.floor(size.y));
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthTexture: new THREE.DepthTexture(w, h) });
      rt.texture.colorSpace = THREE.SRGBColorSpace;   // float storage of display-encoded values (no sRGB8 format)
      rt.isXRRenderTarget = true;            // three r170: tone mapping + output encoding exactly as on screen
      mat.uniforms.tColor.value = rt.texture; mat.uniforms.tDepth.value = rt.depthTexture;
    } else if (rt.width !== w || rt.height !== h) rt.setSize(w, h);   // dynamic resolution / resize
    return rt;
  }

  const moved = () => { const a = cur.elements, b = prev.elements; for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-7) return true; return false; };

  return {
    render(scene, camera, dt) {
      camera.updateMatrixWorld();
      cur.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      if (!on || !havePrev || !prepared.has(scene) || !moved()) {
        renderer.render(scene, camera);
      } else {
        const t = target();
        renderer.setRenderTarget(t); renderer.render(scene, camera); renderer.setRenderTarget(null);
        inv.copy(cur).invert();
        // blur length = screen velocity x exposure time; reference 60 fps, shutter angle in degrees (180 = half a frame)
        mat.uniforms.uScale.value = Math.min(3, (shutterDeg / 360) * (1 / 60) / Math.max(1 / 240, dt || 1 / 60));
        renderer.render(quadScene, quadCam);
      }
      prev.copy(cur); havePrev = true;
    },
    /** Compile the render-target variants of `scene`'s programs (+ the blur pass). Visible objects only. */
    async prepare(scene, camera) {
      if (prepared.has(scene)) return;
      const t = target(), was = renderer.getRenderTarget();
      renderer.setRenderTarget(t);
      const p = renderer.compileAsync(scene, camera);        // parameters are read synchronously, for this target
      renderer.setRenderTarget(was);
      const q = renderer.compileAsync(quadScene, quadCam);
      await Promise.all([p, q]);
      prepared.add(scene);
    },
    setEnabled(v) { on = !!v; havePrev = false; },
    enabled: () => on,
    setShutter(deg) { shutterDeg = Math.min(360, Math.max(45, Number(deg) || 180)); },
    shutter: () => shutterDeg,
    /** Forget last frame's camera (scene switch, instant jump): no smear on the next frame. */
    reset() { havePrev = false; },
    dispose() { rt?.depthTexture?.dispose(); rt?.dispose(); rt = null; mat.dispose(); quad.geometry.dispose(); },
  };
}
