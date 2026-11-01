import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const palettes = {
  calm: { sky: 0x111d2a, ground: 0x263b3a, accent: 0x65c7b4, light: 0xffd8a0, fog: 0x172631 },
  shock: { sky: 0x261b2b, ground: 0x38323c, accent: 0xffbd69, light: 0xffd0a0, fog: 0x302331 },
  warning: { sky: 0x291b20, ground: 0x3c3432, accent: 0xff895e, light: 0xffb36b, fog: 0x332326 },
  chaos: { sky: 0x211b29, ground: 0x39313b, accent: 0xf27662, light: 0xff9878, fog: 0x2b202b },
  aftermath: { sky: 0x14242b, ground: 0x26383a, accent: 0x82c6c0, light: 0xb6d8d0, fog: 0x1b2c32 }
};

export default function WorldView({ mood = 'calm', playing = false }) {
  const host = useRef(null);
  const state = useRef({ mood, playing });
  const visual = useRef(null);
  useEffect(() => { state.current = { mood, playing }; }, [mood, playing]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palettes[mood].sky);
    scene.fog = new THREE.Fog(palettes[mood].fog, 18, 48);
    const camera = new THREE.PerspectiveCamera(42, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(13, 11, 17);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 9;
    controls.maxDistance = 32;
    controls.target.set(0, 1.5, 0);

    const ambient = new THREE.HemisphereLight(0xc8e3ff, 0x29302a, 2.0);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(palettes[mood].light, 3.2);
    sun.position.set(-8, 15, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    const groundMat = new THREE.MeshStandardMaterial({ color: palettes[mood].ground, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.12; ground.receiveShadow = true; scene.add(ground);

    const grid = new THREE.GridHelper(42, 42, 0x638078, 0x40534f);
    grid.position.y = -0.1; grid.material.transparent = true; grid.material.opacity = 0.16; scene.add(grid);

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 });
    const buildingMats = [mat(0x71858a), mat(0x9b806d), mat(0x607c78), mat(0x8c9290), mat(0x7d7180)];
    const roofMats = [mat(0x394b53), mat(0x73564c), mat(0x4c6262)];
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xffd48a, emissive: 0x9a6025, emissiveIntensity: 0.55 });
    const buildings = [];
    for (let x = -4; x <= 4; x += 2) {
      for (let z = -3; z <= 3; z += 2) {
        if (Math.abs(x) < 1 && Math.abs(z) < 1) continue;
        const h = 1.3 + ((Math.abs(x * 7 + z * 11) % 5) * 0.48);
        const group = new THREE.Group();
        const body = new THREE.Mesh(boxGeo, buildingMats[(Math.abs(x + z) % buildingMats.length)]);
        body.scale.set(1.45, h, 1.45); body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; group.add(body);
        const roof = new THREE.Mesh(boxGeo, roofMats[(Math.abs(x * z) % roofMats.length)]);
        roof.scale.set(1.52, 0.16, 1.52); roof.position.y = h + 0.08; roof.castShadow = true; group.add(roof);
        for (let floor = 0; floor < Math.floor(h); floor++) {
          for (const side of [-1, 1]) {
            const win = new THREE.Mesh(boxGeo, windowMat);
            win.scale.set(0.18, 0.2, 0.035);
            win.position.set(side * 0.38, 0.42 + floor * 0.9, 0.74);
            group.add(win);
          }
        }
        group.position.set(x, 0, z); scene.add(group); buildings.push(group);
      }
    }

    const roadMat = mat(0x263238);
    const road = new THREE.Mesh(boxGeo, roadMat);
    road.scale.set(2.4, 0.035, 15); road.position.set(0, 0.01, 0); scene.add(road);
    const road2 = new THREE.Mesh(boxGeo, roadMat);
    road2.scale.set(15, 0.035, 2.4); road2.position.set(0, 0.015, 0); scene.add(road2);

    const trees = [];
    for (const [x, z] of [[-6,-5],[6,-5],[-6,5],[6,5],[-3,7],[3,-7]]) {
      const trunk = new THREE.Mesh(boxGeo, mat(0x725442));
      trunk.scale.set(0.22, 0.8, 0.22); trunk.position.set(x, 0.4, z); scene.add(trunk);
      const crown = new THREE.Mesh(boxGeo, mat(0x497565));
      crown.scale.set(1.05, 1.05, 1.05); crown.position.set(x, 1.15, z); crown.castShadow = true; scene.add(crown);
      trees.push(crown);
    }

    const center = new THREE.Mesh(boxGeo, mat(0x6b8582));
    center.scale.set(1.8, 0.55, 1.8); center.position.set(0, 0.28, 0); center.castShadow = true; scene.add(center);
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.22), new THREE.MeshStandardMaterial({ color: palettes[mood].accent, emissive: palettes[mood].accent, emissiveIntensity: 0.65 }));
    beacon.position.set(0, 1.6, 0); scene.add(beacon);
    visual.current = { scene, sun, groundMat, beaconMat: beacon.material };

    const clock = new THREE.Clock();
    let frame;
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(resize); observer.observe(el);
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (state.current.playing) {
        beacon.rotation.y += 0.018;
        beacon.position.y = 1.6 + Math.sin(t * 2.2) * 0.22;
        buildings.forEach((b, i) => { b.position.y = Math.sin(t * 1.1 + i) * 0.035; });
      } else {
        beacon.rotation.y += 0.003;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
      visual.current = null;
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const view = visual.current;
    if (!view) return;
    const colors = palettes[mood];
    view.scene.background.setHex(colors.sky);
    view.scene.fog.color.setHex(colors.fog);
    view.sun.color.setHex(colors.light);
    view.groundMat.color.setHex(colors.ground);
    view.beaconMat.color.setHex(colors.accent);
    view.beaconMat.emissive.setHex(colors.accent);
  }, [mood]);

  return <div className="world-view" ref={host} aria-label="Interactive 3D voxel village preview"><div className="world-vignette" /></div>;
}