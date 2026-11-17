import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  const [info, setInfo] = useState(
    "Click on parts of the neuron to learn more."
  );

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(
      75,
      800 / 500,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
    });

    renderer.setSize(900, 500);
    mountRef.current.appendChild(renderer.domElement);

    const light = new THREE.PointLight(0xffffff, 3);
    light.position.set(5, 5, 5);
    scene.add(light);

    const neuronMaterial = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
    });

    // CELL BODY (SOMA)

    const soma = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      neuronMaterial
    );

    soma.name = "soma";
    scene.add(soma);

    // DENDRITES

    const dendrites: THREE.Mesh[] = [];

    for (let i = 0; i < 8; i++) {
      const dendrite = new  THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2),neuronMaterial);   dendrite.position.x=
        Math.cos((i * Math.PI) / 4) * 1.2;

      dendrite.position.y =
        Math.sin((i * Math.PI) / 4) * 1.2;

      dendrite.rotation.z =
        (i * Math.PI) / 4;

      dendrite.name = "dendrite";

      scene.add(dendrite);

      dendrites.push(dendrite);
    }

    // AXON

    const axon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 5),
      neuronMaterial
    );

    axon.rotation.z = Math.PI / 2;
    axon.position.x = 3;

    axon.name = "axon";

    scene.add(axon);

    // AXON TERMINAL

    const terminal = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      neuronMaterial
    );

    terminal.position.x = 5.7;
    terminal.name = "terminal";

    scene.add(terminal);

    // SIGNAL

    const signal = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffff00,
      })
    );

    signal.visible = false;
    scene.add(signal);

    let signalMoving = false;
    let signalX = 0;

    (window as any).fireNeuronSignal = () => {
      signal.visible = true;
      signalMoving = true;
      signalX = 0;
    };

    camera.position.z = 10;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const clickable = [
      soma,
      axon,
      terminal,
      ...dendrites,
    ];

    const handleClick = (event: MouseEvent) => {
      const rect =
        renderer.domElement.getBoundingClientRect();

      mouse.x =
        ((event.clientX - rect.left) / rect.width) * 2 -
        1;

      mouse.y =
        -(
          (event.clientY - rect.top) /
          rect.height
        ) *
          2 +
        1;

      raycaster.setFromCamera(mouse, camera);

      const intersects =
        raycaster.intersectObjects(clickable);

      if (intersects.length > 0) {
        const part =
          intersects[0].object.name;

        if (part === "soma") {
          setInfo(
            "Soma (Cell Body): Processes and integrates neural signals."
          );
        }

        if (part === "axon") {
          setInfo(
            "Axon: Carries electrical signals away from the neuron."
          );
        }

        if (part === "dendrite") {
          setInfo(
            "Dendrites: Receive information from other neurons."
          );
        }

        if (part === "terminal") {
          setInfo(
            "Axon Terminal: Sends signals to the next neuron."
          );
        }
      }
    };

    renderer.domElement.addEventListener(
      "click",
      handleClick
    );

    function animate() {
      requestAnimationFrame(animate);

      soma.rotation.y += 0.01;

      if (signalMoving) {
        signal.position.x = signalX;
        signalX += 0.05;

        if (signalX > 5.5) {
          signalMoving = false;
          signal.visible = false;
        }
      }

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      renderer.domElement.removeEventListener(
        "click",
        handleClick
      );
    };
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <h1>🧠 3D Neuroscience Explorer</h1>

      <button
        onClick={() =>
          (window as any).fireNeuronSignal()
        }
      >
        Fire Signal
      </button>

      <p>{info}</p>

      <div ref={mountRef}></div>
    </div>
  );
}

export default App;