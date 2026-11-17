import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type PartId = "soma" | "dendrites" | "axon" | "terminal";
type Part = { id: PartId; name: string; role: string; detail: string; location: string };
const PARTS: Part[] = [
  { id: "soma", name: "Cell body · Soma", role: "Integration centre", detail: "The soma contains the nucleus and much of the neuron's cytoplasm. It maintains the cell and integrates incoming signals from its dendrites.", location: "Central region" },
  { id: "dendrites", name: "Dendrites", role: "Signal reception", detail: "Dendrites are branched extensions that receive synaptic input from other cells and carry graded electrical changes toward the soma.", location: "Branched extensions around the soma" },
  { id: "axon", name: "Axon", role: "Signal conduction", detail: "The axon is a long projection that conducts action potentials away from the cell body toward other cells. This teaching model shows an unmyelinated axon.", location: "Long projection extending to the right" },
  { id: "terminal", name: "Axon terminals", role: "Synaptic communication", detail: "Axon terminals form presynaptic endings. At a chemical synapse, an arriving action potential can trigger neurotransmitter release into the synaptic cleft.", location: "End branches of the axon" },
];
const STRUCTURES = [
  { name: "Neuron", category: "Cellular structures", description: "A specialised cell that receives, processes and transmits information.", significance: "Neurons form the communication network of the nervous system.", available: true, tag: "3D MODEL" },
  { name: "Cell membrane", category: "Cellular structures", description: "A selectively permeable phospholipid bilayer surrounding a cell.", significance: "Regulates exchange and supports cell signalling.", available: false, tag: "REFERENCE" },
  { name: "Mitochondrion", category: "Organelles", description: "A double-membraned organelle involved in aerobic energy conversion.", significance: "Supplies much of the ATP used by eukaryotic cells.", available: false, tag: "REFERENCE" },
  { name: "DNA double helix", category: "Molecules", description: "Two antiparallel nucleotide strands arranged in a double helix.", significance: "Stores hereditary information in living organisms.", available: false, tag: "REFERENCE" },
];
const CATEGORIES = ["All structures", "Cellular structures", "Organelles", "Molecules"];

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<PartId>("soma");
  const [selected, setSelected] = useState<PartId>("soma");
  const [labelsOn, setLabelsOn] = useState(true);
  const [activeTab, setActiveTab] = useState<"explore" | "library">("explore");
  const [category, setCategory] = useState("All structures");
  const [query, setQuery] = useState("");
  const [signalRunning, setSignalRunning] = useState(false);
  const [zoomLevel, setZoomLevel] = useState("Overview");

  const selectPart = useCallback((id: PartId) => {
    selectedRef.current = id;
    setSelected(id);
  }, []);
  const activePart = useMemo(() => PARTS.find((part) => part.id === selected) ?? PARTS[0], [selected]);
  const filtered = useMemo(() => STRUCTURES.filter((item) =>
    (category === "All structures" || item.category === category) &&
    (item.name + " " + item.description).toLowerCase().includes(query.toLowerCase())
  ), [category, query]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      host.dataset.error = "WebGL is unavailable in this browser.";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x081521, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "neuron-canvas";
    renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional neuron model. Drag to rotate and scroll to zoom.");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081521);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.4, 13.5);
    const rig = new THREE.Group();
    scene.add(rig);
    scene.add(new THREE.HemisphereLight(0xb9e7f0, 0x12283a, 2.1));
    const key = new THREE.DirectionalLight(0xefffff, 2.4);
    key.position.set(-4, 7, 8); scene.add(key);
    const rim = new THREE.PointLight(0x24c8c2, 38, 24);
    rim.position.set(2, -2, -3); scene.add(rim);

    const mat = (color: number, roughness = 0.42) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08 });
    const somaMat = mat(0x39b9b0, 0.32);
    const branchMat = mat(0x5c9da9, 0.48);
    const axonMat = mat(0x8cc8cf, 0.38);
    const terminalMat = mat(0x4ed1bd, 0.34);
    const clickable: THREE.Object3D[] = [];
    const makePart = (id: PartId, geometry: THREE.BufferGeometry, material: THREE.Material, position?: THREE.Vector3) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.partId = id;
      if (position) mesh.position.copy(position);
      rig.add(mesh); clickable.push(mesh); return mesh;
    };
    makePart("soma", new THREE.SphereGeometry(1.05, 48, 36), somaMat);
    // Dendritic trees are tapered tubes following explicit 3D paths.
    const dendritePaths = [
      [[-.72,.65,0],[-1.5,1.2,.05],[-2.3,1.55,.18],[-3.1,1.5,.2]],
      [[-.9,.18,.3],[-1.8,.35,.45],[-2.6,.15,.55],[-3.25,-.25,.7]],
      [[-.75,-.65,0],[-1.4,-1.35,-.1],[-2.15,-1.8,-.2],[-2.8,-2.35,-.2]],
      [[-.2,.95,-.15],[-.35,1.8,-.2],[-.8,2.45,-.25],[-1.25,2.9,-.3]],
      [[.55,.78,.2],[.95,1.55,.25],[1.55,2.05,.35],[2.1,2.2,.4]],
    ];
    dendritePaths.forEach((path) => {
      const curve = new THREE.CatmullRomCurve3(path.map(([x,y,z]) => new THREE.Vector3(x,y,z)));
      makePart("dendrites", new THREE.TubeGeometry(curve, 28, .105, 9, false), branchMat);
      path.slice(2).forEach(([x,y,z]) => {
        const twig = new THREE.CatmullRomCurve3([new THREE.Vector3(x,y,z), new THREE.Vector3(x-.28,y+.35,z+.06), new THREE.Vector3(x-.52,y+.48,z+.08)]);
        makePart("dendrites", new THREE.TubeGeometry(twig, 12, .055, 7, false), branchMat);
      });
    });
    const axonCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(.82,-.08,0),new THREE.Vector3(2.1,-.12,0),new THREE.Vector3(3.7,-.08,0),new THREE.Vector3(5.1,.02,0)]);
    makePart("axon", new THREE.TubeGeometry(axonCurve, 48, .19, 12, false), axonMat);
    const terminalPaths = [
      [[4.95,.02,0],[5.55,.55,.08],[6.15,.9,.12],[6.65,1.35,.16]],
      [[5.15,.02,0],[5.85,-.38,.05],[6.45,-.75,.1],[6.9,-1.2,.15]],
      [[5.65,.55,.08],[5.75,1.15,.15],[5.55,1.65,.2]],
    ];
    terminalPaths.forEach((path) => {
      const curve = new THREE.CatmullRomCurve3(path.map(([x,y,z]) => new THREE.Vector3(x,y,z)));
      makePart("terminal", new THREE.TubeGeometry(curve, 24, .105, 9, false), terminalMat);
      const [x,y,z] = path[path.length - 1];
      makePart("terminal", new THREE.SphereGeometry(.14, 16, 12), terminalMat, new THREE.Vector3(x,y,z));
    });

    const labelSprites: THREE.Sprite[] = [];
    const addLabel = (text: string, position: THREE.Vector3) => {
      const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.fillStyle = "rgba(7, 25, 38, .88)"; ctx.strokeStyle = "rgba(91, 218, 211, .8)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(5, 5, 502, 118, 22); ctx.fill(); ctx.stroke();
      ctx.font = "600 34px Inter, Arial"; ctx.fillStyle = "#e4fbfa"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 256, 65);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.position.copy(position); sprite.scale.set(2.35, .59, 1); sprite.userData.level = "mid";
      rig.add(sprite); labelSprites.push(sprite);
    };
    addLabel("DENDRITES", new THREE.Vector3(-2.4, 2.0, .4));
    addLabel("SOMA", new THREE.Vector3(-.1, -1.45, .4));
    addLabel("AXON", new THREE.Vector3(3.25, -.55, .2));
    addLabel("AXON TERMINALS", new THREE.Vector3(6.15, 1.75, .3));

    const signal = new THREE.Mesh(new THREE.SphereGeometry(.12, 18, 14), new THREE.MeshBasicMaterial({ color: 0xf7cf72 }));
    signal.visible = false; rig.add(signal);
    let signalProgress = 0;
    let signalActive = false;

    let dragging = false, moved = false, lastX = 0, lastY = 0;
    let rotationX = -.08, rotationY = -.12, targetRotationX = rotationX, targetRotationY = rotationY;
    let zoom = 13.5;
    const onPointerDown = (event: PointerEvent) => { dragging = true; moved = false; lastX = event.clientX; lastY = event.clientY; renderer.domElement.setPointerCapture(event.pointerId); };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX, dy = event.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      targetRotationY += dx * .008; targetRotationX += dy * .006;
      lastX = event.clientX; lastY = event.clientY;
    };
    const onPointerUp = () => { dragging = false; };
    const onWheel = (event: WheelEvent) => { event.preventDefault(); zoom = THREE.MathUtils.clamp(zoom + event.deltaY * .009, 6, 22); };
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const onClick = (event: MouseEvent) => {
      if (moved) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX-rect.left)/rect.width)*2-1, -((event.clientY-rect.top)/rect.height)*2+1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickable, false)[0];
      if (hit?.object.userData.partId) selectPart(hit.object.userData.partId as PartId);
    };
    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", onPointerDown); canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp); canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false }); canvas.addEventListener("click", onClick);
    const resize = () => {
      const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      rotationX += (targetRotationX-rotationX)*.09; rotationY += (targetRotationY-rotationY)*.09;
      rig.rotation.x = rotationX; rig.rotation.y = rotationY;
      camera.position.z += (zoom-camera.position.z)*.12; camera.lookAt(1.25, .25, 0);
      const level = zoom > 15 ? "Overview" : zoom > 10 ? "Components" : "Detail";
      labelSprites.forEach((sprite) => { sprite.visible = labelsOnRef.current && (level !== "Overview" || sprite.userData.level === "overview"); });
      if (signalActive) {
        signalProgress += .012;
        const p = Math.min(signalProgress, 1);
        signal.position.set(.9 + p*4.25, -.08 + Math.sin(p*Math.PI)*.08, .3);
        signal.visible = true;
        if (p >= 1) { signalActive = false; signal.visible = false; setSignalRunning(false); }
      }
      zoomLevelRef.current = level;
      renderer.render(scene, camera);
    };
    animate();
    resetRef.current = () => { zoom = 13.5; targetRotationX = -.08; targetRotationY = -.12; };
    signalRef.current = () => { signalProgress = 0; signalActive = true; signal.visible = true; };
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown); canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp); canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel); canvas.removeEventListener("click", onClick);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((entry) => { entry.map?.dispose(); entry.dispose(); });
        } else if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [selectPart]);

  const labelsOnRef = useRef(labelsOn);
  const zoomLevelRef = useRef("Overview");
  const resetRef = useRef<() => void>(() => {});
  const signalRef = useRef<() => void>(() => {});
  useEffect(() => { labelsOnRef.current = labelsOn; }, [labelsOn]);
  useEffect(() => { const id = window.setInterval(() => setZoomLevel(zoomLevelRef.current), 180); return () => window.clearInterval(id); }, []);

  const resetView = () => resetRef.current();
  const fireSignal = () => { setSignalRunning(true); signalRef.current(); };
  const openNeuron = () => { setActiveTab("explore"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <main className="bioscope">
      <header className="topbar">
        <a className="brand" href="#home" onClick={() => setActiveTab("explore")}><span className="brand-mark"><span /></span><span>bio<span className="brand-accent">scope</span><small>THE INTERACTIVE BIOLOGY LAB</small></span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={activeTab === "explore" ? "nav-active" : ""} onClick={() => setActiveTab("explore")}>Explore</button>
          <button className={activeTab === "library" ? "nav-active" : ""} onClick={() => setActiveTab("library")}>Library</button>
          <a href="#about">About</a>
        </nav>
        <div className="top-status"><span className="status-dot" /> LEARNING ENVIRONMENT</div>
      </header>

      {activeTab === "explore" ? <>
        <section className="intro" id="home">
          <div className="eyebrow"><span /> BIOLOGY, IN THREE DIMENSIONS</div>
          <h1>See the structures<br /><em>that make life work.</em></h1>
          <p className="intro-copy">Explore biological systems in an interactive 3D space. Rotate, inspect and understand the structures behind living processes.</p>
          <div className="intro-actions"><button className="primary-btn" onClick={() => document.getElementById("laboratory")?.scrollIntoView({ behavior: "smooth" })}>Enter the laboratory <span>↗</span></button><button className="text-btn" onClick={() => setActiveTab("library")}>Browse the library <span>→</span></button></div>
        </section>
        <section className="lab-section" id="laboratory">
          <div className="section-heading"><div><div className="eyebrow"><span /> LIVE 3D WORKSPACE</div><h2>The neuron, <em>up close.</em></h2></div><div className="model-meta"><span className="live-indicator" /> INTERACTIVE MODEL <b>·</b> CELL BIOLOGY</div></div>
          <div className="lab-layout">
            <div className="viewer-panel">
              <div className="viewer-topline"><div><span className="tiny-index">01</span><span>NEURON / OVERVIEW</span></div><span className="viewer-live"><i /> RENDER ACTIVE</span></div>
              <div className="viewer-stage">
                <div ref={mountRef} className="three-host" />
                <div className="axis-label axis-x">X <span>—</span></div><div className="axis-label axis-y">Y <span>—</span></div>
                <div className="view-hint"><span className="mouse-glyph">⌖</span> DRAG TO ROTATE <b>·</b> SCROLL TO ZOOM</div>
                <div className="zoom-chip">{zoomLevel.toUpperCase()}</div>
              </div>
              <div className="viewer-controls">
                <div className="control-group"><button onClick={resetView} title="Reset camera">↺ <span>Reset view</span></button><button className={labelsOn ? "control-on" : ""} onClick={() => setLabelsOn((value) => !value)} title="Toggle labels">⌗ <span>Labels {labelsOn ? "on" : "off"}</span></button></div>
                <button className="signal-btn" onClick={fireSignal} disabled={signalRunning}>{signalRunning ? "Signal travelling…" : "▷  Trace a signal"}</button>
              </div>
            </div>
            <aside className="inspector">
              <div className="inspector-head"><div><span className="tiny-index">02</span> STRUCTURE INSPECTOR</div><span className="inspector-live">READY</span></div>
              <div className="inspector-body">
                <div className="part-kicker">SELECTED COMPONENT</div><h3>{activePart.name}</h3><div className="part-role">{activePart.role}</div>
                <p>{activePart.detail}</p>
                <div className="data-divider" />
                <div className="data-row"><span>STRUCTURAL POSITION</span><b>{activePart.location}</b></div>
                <div className="data-row"><span>PARENT STRUCTURE</span><b>Neuron</b></div>
                <div className="data-row"><span>MODEL TYPE</span><b>Schematic 3D geometry</b></div>
                <div className="inspector-note"><span>i</span><p>Educational explanation. This is a simplified teaching model, not an atomic-resolution structure or a molecular dynamics simulation.</p></div>
              </div>
              <div className="component-list"><div className="list-label">EXPLORE COMPONENTS <span>SELECT TO INSPECT</span></div>{PARTS.map((part, index) => <button key={part.id} className={selected === part.id ? "component-active" : ""} onClick={() => selectPart(part.id)}><span className="component-number">0{index+1}</span><span>{part.name}</span><span className="component-arrow">↗</span></button>)}</div>
            </aside>
          </div>
          <div className="lab-footnote"><span>MODEL NOTE</span> The neuron is a simplified 3D educational representation. Geometry is illustrative; labels and inspector content identify the represented structures.</div>
        </section>
        <section className="pathway" id="about"><div><div className="eyebrow"><span /> A BETTER WAY TO LEARN</div><h2>From looking<br />to <em>understanding.</em></h2></div><div className="pathway-steps">{["Explore","Visualize","Inspect","Understand"].map((step, i) => <div key={step}><span>0{i+1}</span><b>{step}</b><i>↗</i></div>)}</div></section>
      </> : <section className="library-page">
        <div className="eyebrow"><span /> BIOLOGICAL STRUCTURE INDEX</div><h1>Explore the <em>library.</em></h1><p className="intro-copy">A focused collection of structures with clear model availability. Open the neuron to enter the interactive lab.</p>
        <div className="library-tools"><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search structures…" /></label><div className="filter-row">{CATEGORIES.map((item) => <button key={item} className={category === item ? "filter-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
        <div className="library-count">{filtered.length} STRUCTURES <span>· MODEL AVAILABILITY SHOWN CLEARLY</span></div>
        <div className="library-list">{filtered.map((item, index) => <article className="library-item" key={item.name}><span className="library-number">0{index+1}</span><div className="library-main"><div className="library-category">{item.category}</div><h3>{item.name}</h3><p>{item.description}</p><small>{item.significance}</small></div><div className="library-action"><span className={item.available ? "available" : "reference"}>{item.available ? "3D MODEL AVAILABLE" : "REFERENCE ENTRY"}</span>{item.available ? <button onClick={openNeuron}>Explore model ↗</button> : <span className="not-ready">3D model not yet available</span>}</div></article>)}
          {filtered.length === 0 && <div className="empty-state">No structures match that search. Try another term or category.</div>}
        </div>
      </section>}
      <footer className="footer"><a className="brand footer-brand" href="#home" onClick={() => setActiveTab("explore")}><span className="brand-mark"><span /></span><span>bio<span className="brand-accent">scope</span><small>THE INTERACTIVE BIOLOGY LAB</small></span></a><span>LEARN THE FORM. UNDERSTAND THE FUNCTION.</span><span>© BIOSCOPE · STUDENT PROJECT</span></footer>
    </main>
  );
}

export default App;
