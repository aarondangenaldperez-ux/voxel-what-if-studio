import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildEnvironment } from './engine/environmentBuilders.js';
import { buildVoxelPresenter } from './engine/voxelPresenter.js';

const CAMERA_SHOTS = {
  establish: { position: [22, 19, 25], target: [0, 1, 0] },
  event: { position: [4, 6, 19], target: [0, 2.55, 8.5] },
  detail: { position: [0, 4.3, 15.5], target: [0, 3.05, 8.7] },
  aftermath: { position: [-9, 8, 19], target: [0, 2.45, 7.5] },
  resolve: { position: [10, 7, 22], target: [0, 2.5, 7.5] }
};

const RUBBER_CAMERA_SHOTS = {
  ...CAMERA_SHOTS,
  event: { position: [14, 8, 18], target: [0, 0.8, 0] },
  detail: { position: [-9.8, 4.6, 8.8], target: [-8.2, 0.7, 1.55] },
  aftermath: { position: [-13, 7.5, 15], target: [0, 0.9, 0] }
};

const ENVIRONMENT_MOODS = {
  ocean: { calm:{sky:0x06344a,fog:0x0a4050},shock:{sky:0x0a5366,fog:0x0a4050},warning:{sky:0x184a58,fog:0x0a4050},chaos:{sky:0x123b50,fog:0x0a4050},aftermath:{sky:0x06344a,fog:0x0a4050} },
  space: { calm:{sky:0x050916,fog:0x050916},shock:{sky:0x18142a,fog:0x050916},warning:{sky:0x1a111d,fog:0x050916},chaos:{sky:0x100d25,fog:0x050916},aftermath:{sky:0x050916,fog:0x050916} },
  nature: { calm:{sky:0x91a98c,fog:0x91a98c},shock:{sky:0x9f806e,fog:0x9f806e},warning:{sky:0x9a7764,fog:0x9a7764},chaos:{sky:0x716f75,fog:0x716f75},aftermath:{sky:0x91a98c,fog:0x91a98c} },
  airport: { calm:{sky:0x7a9ab2,fog:0x7a9ab2},shock:{sky:0x826d79,fog:0x826d79},warning:{sky:0x806a69,fog:0x806a69},chaos:{sky:0x665f71,fog:0x665f71},aftermath:{sky:0x7a9ab2,fog:0x7a9ab2} },
  school: { calm:{sky:0x8eacc0,fog:0x8eacc0},shock:{sky:0x987c82,fog:0x987c82},warning:{sky:0x96777a,fog:0x96777a},chaos:{sky:0x746875,fog:0x746875},aftermath:{sky:0x8eacc0,fog:0x8eacc0} },
  factory: { calm:{sky:0x4a555b,fog:0x4a555b},shock:{sky:0x553e45,fog:0x553e45},warning:{sky:0x5b3e42,fog:0x5b3e42},chaos:{sky:0x3d3545,fog:0x3d3545},aftermath:{sky:0x4a555b,fog:0x4a555b} }
};

const MOODS = {
  calm: { sky: 0x14222d, fog: 0x1b2d37 },
  shock: { sky: 0x2a202b, fog: 0x33242c },
  warning: { sky: 0x2b2024, fog: 0x36272a },
  chaos: { sky: 0x241f2c, fog: 0x30252f },
  aftermath: { sky: 0x14242b, fog: 0x1b2c32 }
};

export default function WorldView({ scenario, beat, playing, cameraMode = 'auto', lighting = 100, presenterVisible = true, captureRef, timelineRef }) {
  const host = useRef(null);
  const state = useRef({ scenario, beat, playing, cameraMode, lighting, presenterVisible, timelineRef });

  useEffect(() => {
    state.current = { scenario, beat, playing, cameraMode, lighting, presenterVisible, timelineRef };
  }, [scenario, beat, playing, cameraMode, lighting, presenterVisible, timelineRef]);

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
    // Keep the live Three.js preview within a mobile-friendly GPU budget.
    const compactViewport = window.matchMedia('(max-width: 640px)').matches;
    const previewPixelRatio = Math.min(window.devicePixelRatio || 1, compactViewport ? 1.25 : 1.6);
    renderer.setPixelRatio(previewPixelRatio);
    element.dataset.renderPixelRatio = String(previewPixelRatio);
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

    const hemisphereLight = new THREE.HemisphereLight(0xc8e3ff, 0x29302a, 1.9);
    scene.add(hemisphereLight);
    const keyLight = new THREE.DirectionalLight(0xffdfb2, 3.0);
    keyLight.position.set(-12, 22, 15);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(compactViewport ? 1024 : 1536, compactViewport ? 1024 : 1536);
    keyLight.shadow.camera.left = -28;
    keyLight.shadow.camera.right = 28;
    keyLight.shadow.camera.top = 28;
    keyLight.shadow.camera.bottom = -28;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x83a8cf, 0.8);
    fillLight.position.set(15, 12, -14);
    scene.add(fillLight);

    const city = buildEnvironment(scene, scenario?.environment || 'urban');
    const presenter = buildVoxelPresenter(scene, { position: [0, 0, 9], scale: 1.05 });
    const cameraPosition = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    const skyTarget = new THREE.Color();
    const fogTarget = new THREE.Color();
    let frameId = 0;
    let exportSize = null;

    function resize() {
      const width = Math.max(1, exportSize?.width || element.clientWidth);
      const height = Math.max(1, exportSize?.height || element.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    resize();

    if (captureRef) {
      captureRef.current = {
        canvas: renderer.domElement,
        setOutputSize(width, height) {
          controls.enabled = false;
          renderer.setPixelRatio(1);
          exportSize = { width, height };
          resize();
        },
        resetOutputSize() {
          exportSize = null;
          renderer.setPixelRatio(previewPixelRatio);
          controls.enabled = true;
          resize();
        }
      };
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      const current = state.current;
      const elapsed = Math.max(0, Number(current.timelineRef?.current) || 0);
      element.dataset.timelineSeconds = elapsed.toFixed(3);
      const currentScenario = current.scenario;
      const currentBeat = current.beat || {};
      const event = currentBeat.event || 'normal';
      const isPlaying = current.playing;
      const lightScale = THREE.MathUtils.clamp(Number(current.lighting) || 100, 30, 160) / 100;
      hemisphereLight.intensity = THREE.MathUtils.lerp(hemisphereLight.intensity, 1.9 * lightScale, 0.08);
      keyLight.intensity = THREE.MathUtils.lerp(keyLight.intensity, 3.0 * lightScale, 0.08);
      fillLight.intensity = THREE.MathUtils.lerp(fillLight.intensity, 0.8 * lightScale, 0.08);
      element.dataset.lighting = String(Math.round(Number(current.lighting) || 100));
      element.dataset.keyLightIntensity = keyLight.intensity.toFixed(2);
      const manualCamera = current.cameraMode === 'orbit';
      controls.enabled = manualCamera && !exportSize;
      element.dataset.cameraMode = manualCamera ? 'orbit' : 'auto';
      element.dataset.orbitControls = String(controls.enabled);
      if (!manualCamera) {
        const shotLibrary = currentScenario?.id === 'rubber' ? RUBBER_CAMERA_SHOTS : CAMERA_SHOTS;
        const cameraShot = shotLibrary[currentBeat.camera] || shotLibrary.establish;
        cameraPosition.set(cameraShot.position[0], cameraShot.position[1], cameraShot.position[2]);
        cameraTarget.set(cameraShot.target[0], cameraShot.target[1], cameraShot.target[2]);
        camera.position.lerp(cameraPosition, 0.035);
        controls.target.lerp(cameraTarget, 0.035);
      }

      const palette = ENVIRONMENT_MOODS[currentScenario?.environment] || MOODS;
      const mood = palette[currentBeat.mood] || palette.calm || MOODS.calm;
      skyTarget.setHex(mood.sky);
      fogTarget.setHex(mood.fog);
      scene.background.lerp(skyTarget, 0.025);
      if (scene.fog) scene.fog.color.lerp(fogTarget, 0.025);

      const rubberAbsent = currentScenario && currentScenario.id === 'rubber' &&
        event === 'rubber-loss';
      const gravityAbsent = currentScenario && currentScenario.id === 'gravity' &&
        event === 'gravity-loss';
      const powerAbsent = currentScenario && currentScenario.id === 'electricity' &&
        ['power-loss', 'blackout', 'countdown'].includes(event);

      city.update?.({ elapsed, playing: isPlaying, event, scenario: currentScenario, beat: currentBeat });
      presenter.root.visible = current.presenterVisible !== false;
      if (presenter.root.visible) presenter.update({ elapsed, playing: isPlaying, beat: currentBeat });
      element.dataset.presenterVisible = String(presenter.root.visible);
      element.dataset.presenterSpeaking = String(isPlaying);

      city.cars.forEach((car, index) => {
        const base = car.root.userData.basePosition;
        car.wheels.forEach((wheel) => {
          wheel.visible = true;
          const wheelScale = rubberAbsent ? 0.001 : 1;
          wheel.scale.setScalar(THREE.MathUtils.lerp(wheel.scale.x, wheelScale, 0.18));
        });
        const targetY = gravityAbsent ? 0.95 + (index * 0.18) : (rubberAbsent ? -0.22 : 0);
        car.root.position.y = THREE.MathUtils.lerp(car.root.position.y, targetY, 0.075);
        const trafficPaused = currentScenario && currentScenario.id === 'rubber' && event === 'traffic-paused';
        const drift = isPlaying && !rubberAbsent && !trafficPaused ? Math.sin(elapsed * 0.8 + index * 1.7) * 0.22 : 0;
        car.root.position.z = base.z + drift;
        const tirelessPitch = rubberAbsent ? (index % 2 === 0 ? -0.055 : 0.055) : 0;
        car.root.rotation.x = THREE.MathUtils.lerp(car.root.rotation.x, tirelessPitch, 0.09);
        car.root.rotation.z = rubberAbsent && isPlaying
          ? Math.sin(elapsed * 6 + index) * 0.045
          : THREE.MathUtils.lerp(car.root.rotation.z, 0, 0.08);
      });

      city.pedestrians.forEach((person, index) => {
        const swing = isPlaying ? Math.sin(elapsed * 4.2 + index * 1.4) * 0.34 : 0;
        person.arms[0].rotation.x = gravityAbsent ? -0.48 : swing;
        person.arms[1].rotation.x = gravityAbsent ? 0.48 : -swing;
        person.legs[0].rotation.x = gravityAbsent ? 0.12 : -swing * 0.8;
        person.legs[1].rotation.x = gravityAbsent ? -0.12 : swing * 0.8;
        const flinch = rubberAbsent ? 0.82 : 0;
        person.arms[0].rotation.z = THREE.MathUtils.lerp(person.arms[0].rotation.z, -flinch, 0.12);
        person.arms[1].rotation.z = THREE.MathUtils.lerp(person.arms[1].rotation.z, flinch, 0.12);
        const lean = rubberAbsent ? (index % 2 === 0 ? 0.045 : -0.045) : 0;
        person.root.rotation.z = THREE.MathUtils.lerp(person.root.rotation.z, lean, 0.1);
        const floatHeight = gravityAbsent ? 0.95 + Math.sin(elapsed * 2.1 + index) * 0.2 : 0;
        person.root.position.y = THREE.MathUtils.lerp(person.root.position.y, floatHeight, 0.06);
      });

      if (city.windowMaterial) city.windowMaterial.emissiveIntensity = THREE.MathUtils.lerp(
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

    const renderStatus = document.createElement('div');
    renderStatus.className = 'render-status';
    renderStatus.setAttribute('role', 'status');
    renderStatus.hidden = true;

    const handleContextLost = (event) => {
      event.preventDefault();
      renderStatus.textContent = '3D graphics paused by the browser. Waiting for the graphics context to recover…';
      renderStatus.hidden = false;
      if (!renderStatus.parentNode) element.appendChild(renderStatus);
    };
    const handleContextRestored = () => {
      renderStatus.textContent = '3D graphics restored. Rebuilding the scene…';
      renderStatus.hidden = false;
      requestAnimationFrame(() => {
        renderStatus.hidden = true;
        renderStatus.remove();
      });
    };

    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    animate();

    return () => {
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored, false);
      renderStatus.remove();
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      if (captureRef?.current?.canvas === renderer.domElement) captureRef.current = null;
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
  }, [scenario?.environment, captureRef]);

  return <div className="world-view" ref={host} data-environment={scenario?.environment || 'urban'} aria-label="Interactive animated 3D scenario preview" />;
}