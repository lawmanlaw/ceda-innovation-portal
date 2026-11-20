'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// Scroll story: the CEDA headset opens the page logo first, whooshes forward, turns through what the
// portal does, and comes back to the logo for the call to action. three.js loads only on this page,
// after first paint, and stops drawing whenever the section is off screen.
const BEATS = [
  { side: 'center', title: '', body: '', bg: 'gaborone' },
  { side: 'center', title: 'Innovate with CEDA', body: 'One home for the ideas that will grow Botswana\u2019s next businesses.', bg: 'gaborone' },
  { side: 'left', title: 'Ideas from every district', body: 'Farming, factories, services or a better way for CEDA to work. Submit from anywhere in minutes and save drafts as you go.', bg: 'cabbages' },
  { side: 'right', title: 'Reviewed fairly, tracked all the way', body: 'Experts score every idea on six published criteria. You see each step, talk to the panel, and awarded ideas get next steps and a project space.', bg: 'whiteboard' },
  { side: 'left', title: 'No idea yet? Start with a challenge', body: 'Browse real problems reported by communities across Botswana. One of them could spark your next venture.', bg: 'poultry' },
  { side: 'center', title: 'Convinced? Ready to innovate with CEDA', body: '', bg: 'bulbs' },
] as const;
const N = BEATS.length;

// camera distance and sideways shift at each beat; the turn happens across beats 2 to 5
const Z = [8.5, 4.4, 7, 7, 7, 6];
const X = [0, 0, 1.15, -1.15, 1.15, 0];
const Y = [0, -0.38, 0, 0, 0, 0.42];
const ease = (t: number) => t * t * (3 - 2 * t);
const at = (arr: readonly number[], p: number) => {
  const f = Math.min(N - 1, Math.max(0, p * (N - 1)));
  const i = Math.min(N - 2, Math.floor(f));
  return arr[i] + (arr[i + 1] - arr[i]) * ease(f - i);
};

export default function HeadsetStory({ start }: { start: string }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [beat, setBeat] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [vivid, setVivid] = useState(false);
  const pin = useRef<HTMLDivElement>(null);
  const lastY = useRef(0);

  useEffect(() => {
    let stop = false, raf = 0, visible = true;
    let cleanup = () => {};
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = section.current!, cv = canvas.current!;
    const progress = () => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight))); };
    const onScroll = () => {
      setBeat(Math.min(N - 1, Math.round(progress() * (N - 1))));
      if (Math.abs(scrollY - lastY.current) > 40) { setVivid(false); lastY.current = scrollY; } // scrolling brings the wash back
    };
    // the photo shows in full colour wherever the mouse is
    const spot = (e: PointerEvent) => { const r = pin.current?.getBoundingClientRect(); if (!r) return; pin.current!.style.setProperty('--mx', `${e.clientX - r.left}px`); pin.current!.style.setProperty('--my', `${e.clientY - r.top}px`); };
    el.addEventListener('pointermove', spot);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
        const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
        if (stop) return;
        const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        const sun = new THREE.DirectionalLight(0xfff1e6, 1.5); sun.position.set(3, 4, 5); scene.add(sun);
        const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
        const pivot = new THREE.Group(); scene.add(pivot);
        const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/headset.glb');
        if (stop) return;
        const m = gltf.scene, box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
        const s = 2 / Math.max(size.x, size.y, size.z);
        m.position.copy(c).multiplyScalar(-s); m.scale.setScalar(s);
        const upright = new THREE.Group(); upright.rotation.x = -Math.PI / 2; upright.add(m); pivot.add(upright);

        const narrow = () => innerWidth < 760;
        const resize = () => { const w = cv.clientWidth, h = cv.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
        const ro = new ResizeObserver(resize); ro.observe(cv); resize();
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }); io.observe(el);

        let cur = 0, last = performance.now(), born = performance.now(), drag = 0, dragV = 0, px: number | null = null;
        let downX = 0;
        const down = (e: PointerEvent) => { px = e.clientX; downX = e.clientX; };
        const move = (e: PointerEvent) => { if (px === null) return; dragV = (e.clientX - px) * 0.01; drag += dragV; px = e.clientX; };
        const up = (e: PointerEvent) => { if (px !== null && Math.abs(e.clientX - downX) < 6) { lastY.current = scrollY; setVivid((v) => !v); } px = null; };
        cv.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up);

        function loop() {
          cancelAnimationFrame(raf);
          if (stop || !visible) return;
          const p = progress();
          const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
          cur += (p - cur) * (reduce ? 1 : 1 - Math.exp(-dt * 5)); // same feel at any frame rate
          if (px === null) { dragV *= 0.92; drag += dragV; drag *= 0.97; }
          const intro = reduce ? 1 : ease(Math.min(1, (performance.now() - born) / 1100)); // arrival on load
          const turn = Math.min(1, Math.max(0, (cur * (N - 1) - 1.5) / 3)); // beats 1.5 to 4.5
          const mid = Math.sin(turn * Math.PI);
          pivot.rotation.y = ease(turn) * Math.PI * 2 + drag + (1 - intro) * -0.6;
          pivot.rotation.x = 0.06 - mid * 0.22;
          const t = performance.now() / 1000;
          pivot.position.y = (reduce ? 0 : Math.sin(t * 1.4) * 0.04) + at(Y, cur) + (narrow() ? 0.55 : 0) - (1 - intro) * 0.6;
          pivot.position.x = narrow() ? 0 : at(X, cur);
          camera.position.set(0, 0.1, at(Z, cur) + (narrow() ? 2.4 : 0) + (1 - intro) * 4);
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        }
        setReady(true); loop();
        cleanup = () => { ro.disconnect(); io.disconnect(); removeEventListener('pointermove', move); removeEventListener('pointerup', up); cv.removeEventListener('pointerdown', down); renderer.dispose(); pmrem.dispose(); };
      } catch { if (!stop) setFailed(true); }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); removeEventListener('scroll', onScroll); el.removeEventListener('pointermove', spot); cleanup(); };
  }, []);

  return (
    <section ref={section} className="hs" aria-label="Innovate with CEDA">
      <div ref={pin} className={`hs-pin${vivid ? ' vivid' : ''}`}>
        {BEATS.map((b, i) => (i > 0 && BEATS[i - 1].bg === b.bg ? null : (
          <img key={b.bg} className={`hs-bg${BEATS[beat].bg === b.bg ? ' on' : ''}`} src={`/img/${b.bg}.webp`} alt="" aria-hidden="true" decoding="async" loading={i === 0 ? 'eager' : 'lazy'} />
        )))}
        <canvas ref={canvas} className={`hs-canvas${ready ? ' on' : ''}`} aria-hidden="true" />
        {(!ready || failed) && <img className={`hs-poster${failed ? ' still' : ''}`} src="/models/headset.webp" alt="" aria-hidden="true" />}
        {BEATS.map((b, i) => (
          <div key={i} className={`hs-beat ${b.side}${beat === i ? ' on' : ''}${i === 1 ? ' big' : ''}`} aria-hidden={beat !== i}>
            {i === 0 && <p className="hs-cue">Tap the headset for colour, scroll to explore</p>}
            {b.title && (i === 1 ? <h1>{b.title}</h1> : <h2>{b.title}</h2>)}
            {b.body && <p>{b.body}</p>}
            {i === 4 && <Link className="btn secondary hs-cta-one" href="/challenges" tabIndex={beat === i ? 0 : -1}>Browse challenges</Link>}
            {i === N - 1 && (
              <div className="row hs-cta">
                <Link className="btn" href={start} tabIndex={beat === i ? 0 : -1}>Submit an idea</Link>
                <Link className="btn secondary" href="/challenges" tabIndex={beat === i ? 0 : -1}>Browse challenges</Link>
              </div>
            )}
          </div>
        ))}
        <div className="hs-dots" aria-hidden="true">{BEATS.map((_, i) => <i key={i} className={beat === i ? 'on' : ''} />)}</div>
      </div>
    </section>
  );
}
