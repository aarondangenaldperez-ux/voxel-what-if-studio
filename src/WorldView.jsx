import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildEnvironment } from './engine/environmentBuilders.js';
import { buildVoxelPresenter } from './engine/voxelPresenter.js';
import { getCinematicCameraPose } from './engine/cameraDirector.js';
import {
  getBeatWindow,
  getCityActorPoseAtTime,
  getTimelinePosition,
  smoothStep01
} from './engine/sceneTimeline.js';

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

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 160);
    camera.position.set(0, 25, 43);

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
    const skyFrom = new THREE.Color();
    const skyTarget = new THREE.Color();
    const fogFrom = new THREE.Color();
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
        renderAtTime(seconds) {
          const time = Math.max(0, Number(seconds) || 0);
          if (state.current.timelineRef) state.current.timelineRef.current = time;
          renderScene(time);
        },
        resetOutputSize() {
          exportSize = null;
          renderer.setPixelRatio(previewPixelRatio);
          controls.enabled = true;
          resize();
        }
      };
    }

    function renderScene(elapsedOverride) {
      const current = state.current;
      const elapsed = Number.isFinite(Number(elapsedOverride))
        ? Math.max(0, Number(elapsedOverride))
        : Math.max(0, Number(current.timelineRef?.current) || 0);
      const currentScenario = current.scenario;
      const beats = currentScenario?.beats || [];
      const timeline = getTimelinePosition(beats, elapsed);
      const currentBeat = timeline.beat || current.beat || {};
      const previousBeat = beats[timeline.index - 1] || currentBeat;
      const event = currentBeat.event || 'normal';
      const transition = smoothStep01(timeline.elapsedInBeat / 0.85);

      element.dataset.timelineSeconds = elapsed.toFixed(3);
      element.dataset.activeEvent = event;
      const lightScale = THREE.MathUtils.clamp(Number(current.lighting) || 100, 30, 160) / 100;
      hemisphereLight.intensity = 1.9 * lightScale;
      keyLight.intensity = 3.0 * lightScale;
      fillLight.intensity = 0.8 * lightScale;
      element.dataset.lighting = String(Math.round(Number(current.lighting) || 100));
      element.dataset.keyLightIntensity = keyLight.intensity.toFixed(2);

      const manualCamera = current.cameraMode === 'orbit';
      controls.enableDamping = manualCamera;
      controls.enabled = manualCamera && !exportSize;
      element.dataset.cameraMode = manualCamera ? 'orbit' : 'auto';
      element.dataset.orbitControls = String(controls.enabled);
      if (!manualCamera) {
        const cameraPose = getCinematicCameraPose({
          beats,
          elapsedSeconds: elapsed,
          scenarioId: currentScenario?.id
        });
        camera.position.fromArray(cameraPose.position);
        controls.target.fromArray(cameraPose.target);
        element.dataset.cameraShot = cameraPose.shot;
        element.dataset.cameraBeatProgress = cameraPose.beatProgress.toFixed(3);
      }

      const palette = ENVIRONMENT_MOODS[currentScenario?.environment] || MOODS;
      const previousMood = palette[previousBeat.mood] || palette.calm || MOODS.calm;
      const mood = palette[currentBeat.mood] || palette.calm || MOODS.calm;
      skyFrom.setHex(previousMood.sky);
      skyTarget.setHex(mood.sky);
      fogFrom.setHex(previousMood.fog);
      fogTarget.setHex(mood.fog);
      if (scene.background?.isColor) {
        scene.background.copy(skyFrom).lerp(skyTarget, transition);
      }
      if (scene.fog) scene.fog.color.copy(fogFrom).lerp(fogTarget, transition);

      const productionStopWindow = getBeatWindow(beats, 'production-stop');
      const productionResumeWindow = getBeatWindow(beats, 'production-resume');
      const oceanLossWindow = getBeatWindow(beats, 'ocean-loss');
      const oceanReturnWindow = getBeatWindow(beats, 'ocean-return');

      city.update?.({
        elapsed,
        event,
        scenario: currentScenario,
        beat: currentBeat,
        productionStopStartSeconds: productionStopWindow?.startSeconds ?? 8,
        productionResumeStartSeconds: productionResumeWindow?.startSeconds ?? 27,
        oceanLossStartSeconds: oceanLossWindow?.startSeconds ?? 8,
        oceanReturnStartSeconds: oceanReturnWindow?.startSeconds ?? 27
      });

      presenter.root.visible = current.presenterVisible !== false;
      presenter.update({ elapsed, beat: currentBeat });
      element.dataset.presenterVisible = String(presenter.root.visible);
      element.dataset.presenterSpeaking = String(Boolean(current.playing));

      const primaryScenePose = getCityActorPoseAtTime({
        elapsedSeconds: elapsed,
        scenarioId: currentScenario?.id,
        beats,
        actorIndex: 0
      });
      const powerIntensity = primaryScenePose.powerIntensity;

      city.cars.forEach((car, index) => {
        const pose = getCityActorPoseAtTime({
          elapsedSeconds: elapsed,
          scenarioId: currentScenario?.id,
          beats,
          actorIndex: index
        });
        const base = car.root.userData.basePosition;
        const heading = car.root.userData.baseRotationY ?? car.root.rotation.y;
        car.wheels.forEach((wheel) => {
          wheel.visible = true;
          wheel.scale.setScalar(pose.wheelScale);
          wheel.rotation.x = pose.carWheelRotation;
        });
        car.root.position.x = base.x + Math.sin(heading) * pose.carTravelDistance;
        car.root.position.y = pose.carPositionY;
        car.root.position.z = base.z + Math.cos(heading) * pose.carTravelDistance;
        car.root.rotation.x = pose.carRotationX;
        car.root.rotation.z = pose.carRotationZ;
      });

      city.pedestrians.forEach((person, index) => {
        const pose = getCityActorPoseAtTime({
          elapsedSeconds: elapsed,
          scenarioId: currentScenario?.id,
          beats,
          actorIndex: index
        });
        person.arms[0].rotation.x = pose.pedestrianArmRotationX[0];
        person.arms[1].rotation.x = pose.pedestrianArmRotationX[1];
        person.legs[0].rotation.x = pose.pedestrianLegRotationX[0];
        person.legs[1].rotation.x = pose.pedestrianLegRotationX[1];
        const base = person.root.userData.basePosition;
        person.arms[0].rotation.z = pose.pedestrianArmRotationZ[0];
        person.arms[1].rotation.z = pose.pedestrianArmRotationZ[1];
        person.root.rotation.z = pose.pedestrianRootRotationZ;
        person.root.position.x = base.x;
        person.root.position.y = pose.pedestrianPositionY;
        person.root.position.z = base.z + pose.pedestrianTravelDistance;
      });

      if (city.windowMaterial) {
        city.windowMaterial.emissiveIntensity = THREE.MathUtils.lerp(0.45, 0.015, powerIntensity);
      }
      city.streetlights.forEach((lamp) => {
        lamp.light.intensity = THREE.MathUtils.lerp(2.1, 0, powerIntensity);
        lamp.bulb.material.emissiveIntensity = THREE.MathUtils.lerp(1.6, 0.02, powerIntensity);
      });
      city.signalLights.forEach((material) => {
        material.emissiveIntensity = THREE.MathUtils.lerp(1.4, 0.015, powerIntensity);
      });

      controls.update();
      element.dataset.cameraDistance = camera.position.distanceTo(controls.target).toFixed(2);
      element.dataset.cameraTargetX = controls.target.x.toFixed(2);
      element.dataset.cameraTargetZ = controls.target.z.toFixed(2);
      renderer.render(scene, camera);
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      renderScene();
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