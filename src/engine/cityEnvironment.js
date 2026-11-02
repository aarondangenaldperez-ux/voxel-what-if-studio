import * as THREE from "three";

function makeMaterial(color, options) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.82, metalness: 0.02 }, options || {}));
}

function makeCube(width, height, depth, material, position, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeBuilding(scene, x, z, width, depth, height, palette, shared) {
  const group = new THREE.Group();
  const body = makeCube(width, height, depth, shared.facades[palette % shared.facades.length], [0, height / 2, 0], group);
  makeCube(width + 0.18, 0.2, depth + 0.18, shared.roofs[palette % shared.roofs.length], [0, height + 0.1, 0], group);

  const floors = Math.max(2, Math.floor(height / 1.65));
  const columns = Math.max(2, Math.floor(width / 1.25));
  for (let floor = 0; floor < floors; floor += 1) {
    const wy = 0.9 + floor * 1.55;
    for (let col = 0; col < columns; col += 1) {
      const wx = -width / 2 + ((col + 0.5) * width / columns);
      for (const face of [-1, 1]) {
        const window = makeCube(0.42, 0.58, 0.055, shared.window, [wx, wy, face * (depth / 2 + 0.035)], group);
        window.castShadow = false;
        window.receiveShadow = false;
      }
    }
    const sideColumns = Math.max(2, Math.floor(depth / 1.35));
    for (const face of [-1, 1]) {
      for (let col = 0; col < sideColumns; col += 1) {
        const wz = -depth / 2 + ((col + 0.5) * depth / sideColumns);
        const window = makeCube(0.055, 0.58, 0.42, shared.window, [face * (width / 2 + 0.035), wy, wz], group);
        window.castShadow = false;
        window.receiveShadow = false;
      }
    }
    const band = makeCube(width * 0.94, 0.075, 0.09, shared.trim, [0, wy - 0.45, depth / 2 + 0.055], group);
    band.castShadow = false;
  }
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      const corner = makeCube(0.13, height, 0.13, shared.trim, [sideX * (width / 2 - 0.08), height / 2, sideZ * (depth / 2 - 0.08)], group);
      corner.castShadow = false;
    }
  }

  const door = makeCube(0.8, 1.45, 0.08, shared.door, [0, 0.73, depth / 2 + 0.055], group);
  const awning = makeCube(width * 0.78, 0.28, 0.7, shared.awning, [0, 2.25, depth / 2 + 0.25], group);
  makeCube(width * 0.9, 0.12, 0.12, shared.trim, [0, 2.42, depth / 2 + 0.62], group);

  group.position.set(x, 0, z);
  group.userData.buildingBody = body;
  scene.add(group);
  return group;
}

function makeCar(scene, id, x, z, rotation, color, shared) {
  const root = new THREE.Group();
  root.rotation.y = rotation;
  const body = makeCube(1.65, 0.58, 2.65, makeMaterial(color), [0, 0.72, 0], root);
  makeCube(1.35, 0.72, 1.35, shared.carGlass, [0, 1.31, -0.12], root);
  makeCube(1.52, 0.14, 0.62, shared.trim, [0, 1.05, 0.93], root);

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const tire = new THREE.Mesh(wheelGeo, shared.tire);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(side * 0.83, 0.36, end * 0.84);
      tire.castShadow = true;
      root.add(tire);
      wheels.push(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.27, 8), shared.hub);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(tire.position);
      root.add(hub);
      wheels.push(hub);
    }
  }

  root.position.set(x, 0, z);
  root.userData.entityId = id;
  root.userData.basePosition = root.position.clone();
  root.userData.baseRotationY = rotation;
  root.userData.body = body;
  scene.add(root);
  return { id, root: root, wheels: wheels, body: body };
}

function makePedestrian(scene, x, z, color, shared) {
  const root = new THREE.Group();
  const torso = makeCube(0.62, 0.9, 0.38, makeMaterial(color), [0, 1.18, 0], root);
  const head = makeCube(0.55, 0.55, 0.55, shared.skin, [0, 1.95, 0], root);
  makeCube(0.18, 0.12, 0.08, shared.dark, [-0.13, 2.03, 0.29], root);
  makeCube(0.18, 0.12, 0.08, shared.dark, [0.13, 2.03, 0.29], root);
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.39, 1.52, 0);
    makeCube(0.2, 0.72, 0.22, shared.skin, [0, -0.32, 0], arm);
    root.add(arm);
    arms.push(arm);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.18, 0.78, 0);
    makeCube(0.24, 0.78, 0.28, shared.dark, [0, -0.36, 0], leg);
    root.add(leg);
    legs.push(leg);
  }
  root.position.set(x, 0, z);
  root.userData.basePosition = root.position.clone();
  scene.add(root);
  return { root: root, arms: arms, legs: legs, torso: torso, head: head };
}

function addStreetLight(scene, x, z, shared) {
  const group = new THREE.Group();
  makeCube(0.16, 4.3, 0.16, shared.metal, [0, 2.15, 0], group);
  makeCube(0.95, 0.15, 0.18, shared.metal, [0.38, 4.2, 0], group);
  const bulb = makeCube(0.36, 0.18, 0.32, shared.lamp, [0.78, 4.08, 0], group);
  group.position.set(x, 0, z);
  scene.add(group);
  const light = new THREE.PointLight(0xffd99a, 2.1, 12);
  light.position.set(x + 0.78, 3.95, z);
  scene.add(light);
  return { bulb: bulb, light: light };
}

export function buildCityEnvironment(scene) {
  const shared = {
    facades: [makeMaterial(0x8c9a9b), makeMaterial(0x9c8878), makeMaterial(0x6d8584), makeMaterial(0x797b8e)],
    roofs: [makeMaterial(0x34434d), makeMaterial(0x51454d), makeMaterial(0x465e60)],
    window: makeMaterial(0xffd995, { emissive: 0x9c6228, emissiveIntensity: 0.45 }),
    door: makeMaterial(0x273941),
    awning: makeMaterial(0x9a6254),
    trim: makeMaterial(0xc5b9a3),
    carGlass: makeMaterial(0x314c5b, { metalness: 0.18, roughness: 0.28 }),
    tire: makeMaterial(0x20272b, { roughness: 1 }),
    hub: makeMaterial(0x9eaaa8, { metalness: 0.55, roughness: 0.35 }),
    skin: makeMaterial(0xc68b68),
    dark: makeMaterial(0x25333c),
    metal: makeMaterial(0x56636a, { metalness: 0.5, roughness: 0.45 }),
    lamp: makeMaterial(0xffe0a3, { emissive: 0xffbd66, emissiveIntensity: 1.6 })
  };

  const groundMaterial = makeMaterial(0x293b3d, { roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);

  const asphalt = makeMaterial(0x252d34, { roughness: 1 });
  makeCube(7.4, 0.08, 38, asphalt, [0, 0, 0], scene);
  makeCube(38, 0.08, 7.4, asphalt, [0, 0.015, 0], scene);

  const sidewalk = makeMaterial(0x7b8582, { roughness: 1 });
  for (const side of [-1, 1]) {
    makeCube(1.35, 0.18, 38, sidewalk, [side * 4.35, 0.04, 0], scene);
    makeCube(38, 0.18, 1.35, sidewalk, [0, 0.04, side * 4.35], scene);
  }

  const lane = makeMaterial(0xd7d0b7, { roughness: 1 });
  for (let z = -16; z <= 16; z += 4) {
    makeCube(0.12, 0.025, 1.8, lane, [0, 0.06, z], scene);
    makeCube(1.8, 0.025, 0.12, lane, [z, 0.065, 0], scene);
  }

  const crosswalk = makeMaterial(0xe7e5d8);
  for (let i = -2; i <= 2; i += 1) {
    makeCube(0.52, 0.03, 2.9, crosswalk, [i * 0.95, 0.07, 4.9], scene);
    makeCube(2.9, 0.03, 0.52, crosswalk, [4.9, 0.075, i * 0.95], scene);
  }

  const coords = [
    [-12, -12, 5.4, 5.2, 10.4], [-6, -12, 5, 5.2, 7.2], [6, -12, 5.2, 5.2, 8.6], [12, -12, 5.8, 5.2, 11.4],
    [-12, 12, 5.8, 5.2, 8.5], [-6, 12, 5, 5.2, 6.7], [6, 12, 5, 5.2, 9.5], [12, 12, 5.5, 5.2, 7.7],
    [-12, -5.8, 5.6, 4.5, 6.5], [12, -5.8, 5.6, 4.5, 8.3], [-12, 5.8, 5.6, 4.5, 9.2], [12, 5.8, 5.6, 4.5, 6.2]
  ];
  coords.forEach(function (item, index) {
    makeBuilding(scene, item[0], item[1], item[2], item[3], item[4], index, shared);
  });

  const treeMaterial = makeMaterial(0x4b7864);
  const trunkMaterial = makeMaterial(0x73553f);
  for (const position of [[-5.1, -6.2], [5.1, -6.2], [-5.1, 6.2], [5.1, 6.2], [-15, -2], [15, 2]]) {
    makeCube(0.28, 1.15, 0.28, trunkMaterial, [position[0], 0.58, position[1]], scene);
    makeCube(1.25, 1.3, 1.25, treeMaterial, [position[0], 1.75, position[1]], scene);
  }

  const cars = [
    makeCar(scene, "vehicle-1", -1.65, -8.2, 0, 0x3e8290, shared),
    makeCar(scene, "vehicle-2", 1.55, 8.1, Math.PI, 0xb16d4f, shared),
    makeCar(scene, "vehicle-3", -8.2, 1.55, Math.PI / 2, 0xd1b46d, shared)
  ];

  const pedestrians = [
    makePedestrian(scene, -5.1, 3.6, 0x4a80a0, shared),
    makePedestrian(scene, 5.2, -3.6, 0xb06d58, shared),
    makePedestrian(scene, -5.1, -3.4, 0x8c7baf, shared)
  ];

  const streetlights = [
    addStreetLight(scene, -4.9, -4.9, shared),
    addStreetLight(scene, 4.9, 4.9, shared),
    addStreetLight(scene, -4.9, 4.9, shared),
    addStreetLight(scene, 4.9, -4.9, shared)
  ];

  const signalHousing = makeMaterial(0x303b42);
  const signalDark = makeMaterial(0x37454b);
  const signalLights = [];
  const signal = new THREE.Group();
  makeCube(0.38, 1.35, 0.35, signalHousing, [0, 0.68, 0], signal);
  for (let i = 0; i < 3; i += 1) {
    const color = [0xe45e52, 0xe5b84d, 0x68b986][i];
    const bulbMaterial = makeMaterial(color, { emissive: color, emissiveIntensity: 1.4 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bulbMaterial);
    bulb.position.set(0, 1.12 - i * 0.42, 0.2);
    signal.add(bulb);
    signalLights.push(bulbMaterial);
  }
  signal.position.set(4.7, 0, -4.7);
  scene.add(signal);

  return {
    cars: cars,
    pedestrians: pedestrians,
    streetlights: streetlights,
    windowMaterial: shared.window,
    signalLights: signalLights,
    groundMaterial: groundMaterial
  };
}
