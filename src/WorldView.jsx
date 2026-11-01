import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildCityEnvironment } from './engine/cityEnvironment.js';

const CAMERA_SHOTS = {
  establish: { position: [22, 19, 25], target: [0, 1, 0] },
  event: { position: [11, 10, 15], target: [0, 1.3, 0] },
  detail: { position: [7.5, 6.5, 9], target: [0, 1.4, 1.5] },
  aftermath: { position: [-18, 14, 16], target: [0, 1.2, 0] },
  resolve: { position: [15, 12, 19], target: [0, 1, 0] }
};

const MOODS = {
  calm: { sky: 0x14222d, fog: 0x1b2d37 },
  shock: { sky: 0x2a202b, fog: 0x33242c },
  warning: { sky: 0x2b2024, fog: 0x36272a },
  chaos: { sky: 0x241f2c, fog: 0x30252f },
  aftermath: { sky: 0x14242b, fog: 0x1b2c32 }
};

export default function WorldView({ scenario, beat, playing }) {
  const host = useRef(null);
  const state = useRef({ scenario, beat, playing });

  useEffect(() => {
    state.current = { scenario, beat, playing };
  }, [scenario, beat, playing]);

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(MOODS.calm.sky);
    scene.fog = new THREE.Fog(MOODS.calm.fog, 22, 58);

    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
    camera.position.set(22, 19, 25);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.minDistance = 7;
    controls.maxDistance = 48;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 1, 0);

    scene.add(new THREE.HemisphereLight(0xc8e3ff, 0x29302a, 1.9));
    const keyLight = new THREE.DirectionalLight(0xffdfb2, 3.0);
    keyLight.position.set(-12, 22, 15);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1536, 1536);
    keyLight.shadow.camera.left = -28;
    keyLight.shadow.camera.right = 28;
    keyLight.shadow.camera.top = 28;
    keyLight.shadow.camera.bottom = -28;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x83a8cf, 0.8);
    fillLight.position.set(15, 12, -14);
    scene.add(fillLight);

    const city = buildCityEnvironment(scene);
    const clock = new THREE.Clock();
    const cameraPosition = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    let frameId = 0;

    function resize() {
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    resize();

    function animate() {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const current = state.current;
      const currentScenario = current.scenario;
      const currentBeat = current.beat || {};
      const event = currentBeat.event || 'normal';
      const isPlaying = current.playing;
      const cameraShot = CAMERA_SHOTS[currentBeat.camera] || CAMERA_SHOTS.establish;
      cameraPosition.set(cameraShot.position[0], cameraShot.position[1], cameraShot.position[2]);
      cameraTarget.set(cameraShot.target[0], cameraShot.target[1], cameraShot.target[2]);
      camera.position.lerp(cameraPosition, 0.035);
      controls.target.lerp(cameraTarget, 0.035);

      const mood = MOODS[currentBeat.mood] || MOODS.calm;
      scene.background.lerp(new THREE.Color(mood.sky), 0.025);
      scene.fog.color.lerp(new THREE.Color(mood.fog), 0.025);

      const rubberAbsent = currentScenario && currentScenario.id === 'rubber' &&
        ['rubber-loss', 'traffic-paused', 'countdown'].includes(event);
      const gravityAbsent = currentScenario && currentScenario.id === 'gravity' &&
        ['gravity-loss', 'weightless', 'countdown'].includes(event);
      const powerAbsent = currentScenario && currentScenario.id === 'electricity' &&
        ['power-loss', 'blackout', 'countdown'].includes(event);

      city.cars.forEach((car, index) => {
        const base = car.root.userData.basePosition;
        car.wheels.forEach((wheel) => { wheel.visible = !rubberAbsent; });
        const targetY = gravityAbsent ? 0.95 + (index * 0.18) : (rubberAbsent ? -0.13 : 0);
        car.root.position.y = THREE.MathUtils.lerp(car.root.position.y, targetY, 0.075);
        const drift = isPlaying && !rubberAbsent ? Math.sin(elapsed * 0.8 + index * 1.7) * 0.22 : 0;
        car.root.position.z = base.z + drift;
        car.root.rotation.z = rubberAbsent && isPlaying
          ? Math.sin(elapsed * 8 + index) * 0.018
          : THREE.MathUtils.lerp(car.root.rotation.z, 0, 0.08);
      });

      city.pedestrians.forEach((person, index) => {
        const swing = isPlaying ? Math.sin(elapsed * 4.2 + index * 1.4) * 0.34 : 0;
        person.arms[0].rotation.x = gravityAbsent ? -0.48 : swing;
        person.arms[1].rotation.x = gravityAbsent ? 0.48 : -swing;
        person.legs[0].rotation.x = gravityAbsent ? 0.12 : -swing * 0.8;
        person.legs[1].rotation.x = gravityAbsent ? -0.12 : swing * 0.8;
        const floatHeight = gravityAbsent ? 0.95 + Math.sin(elapsed * 2.1 + index) * 0.2 : 0;
        person.root.position.y = THREE.MathUtils.lerp(person.root.position.y, floatHeight, 0.06);
      });

      city.windowMaterial.emissiveIntensity = THREE.MathUtils.lerp(
        city.windowMaterial.emissiveIntensity,
        powerAbsent ? 0.015 : 0.45,
        0.08
      );
      city.streetlights.forEach((lamp) => {
        const target = powerAbsent ? 0 : 2.1;
        lamp.light.intensity = THREE.MathUtils.lerp(lamp.light.intensity, target, 0.08);
        lamp.bulb.material.emissiveIntensity = THREE.MathUtils.lerp(
          lamp.bulb.material.emissiveIntensity,
          powerAbsent ? 0.02 : 1.6,
          0.08
        );
      });
      city.signalLights.forEach((material) => {
        material.emissiveIntensity = THREE.MathUtils.lerp(
          material.emissiveIntensity,
          powerAbsent ? 0.015 : 1.4,
          0.08
        );
      });

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === element) {
        element.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="world-view" ref={host} aria-label="Interactive animated 3D voxel city preview" />;
}