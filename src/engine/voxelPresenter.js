import * as THREE from "three";

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0.02, ...options });
}

function cube(parent, name, size, position, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function pivot(parent, name, position) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  parent.add(group);
  return group;
}

/**
 * Lightweight procedural voxel host made from named mesh parts and pivots.
 * The hierarchy is intentionally reusable and editable without a GLB asset.
 */
export function buildVoxelPresenter(scene, { position = [0, 0, 9], scale = 1 } = {}) {
  const root = new THREE.Group();
  root.name = "voxel-presenter";
  root.position.set(...position);
  root.scale.setScalar(scale);
  scene.add(root);

  const hoodie = material(0xe1ad35);
  const hoodieShadow = material(0xb97a23);
  const skin = material(0xb77b5a);
  const hair = material(0x241f26, { roughness: 0.94 });
  const hairHighlight = material(0x39313a);
  const pants = material(0x26364c);
  const shoe = material(0xe8e8df);
  const blue = material(0x253d70);
  const white = material(0xf5f3e9);
  const pupil = material(0x171b22);
  const mouthMaterial = material(0x2a1717);
  const browMaterial = material(0x382923);

  cube(root, "hoodie-torso", [1.38, 1.58, 0.78], [0, 1.98, 0], hoodie);
  cube(root, "hoodie-hem", [1.4, 0.16, 0.8], [0, 1.23, 0], hoodieShadow);
  cube(root, "hood", [0.86, 0.78, 0.32], [0, 2.63, -0.43], hoodieShadow);
  cube(root, "neck", [0.46, 0.38, 0.46], [0, 2.76, 0], skin);
  cube(root, "left-drawstring", [0.055, 0.48, 0.045], [-0.14, 2.12, 0.414], white);
  cube(root, "right-drawstring", [0.055, 0.48, 0.045], [0.14, 2.12, 0.414], white);
  const leftToggle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), blue);
  leftToggle.name = "left-hoodie-toggle";
  leftToggle.position.set(-0.48, 2.52, 0.38);
  leftToggle.scale.set(1, 1, 0.38);
  leftToggle.castShadow = true;
  root.add(leftToggle);
  const rightToggle = leftToggle.clone();
  rightToggle.name = "right-hoodie-toggle";
  rightToggle.position.x = 0.48;
  root.add(rightToggle);

  const head = pivot(root, "head-pivot", [0, 3.42, 0]);
  cube(head, "head", [1.42, 1.42, 1.12], [0, 0, 0], skin);
  cube(head, "hair-cap", [1.5, 0.36, 1.2], [0, 0.78, -0.015], hair);
  cube(head, "hair-front-left", [0.56, 0.4, 0.24], [-0.37, 0.54, 0.55], hairHighlight);
  cube(head, "hair-front-center", [0.55, 0.28, 0.25], [0.06, 0.6, 0.57], hair);
  cube(head, "hair-front-right", [0.48, 0.36, 0.24], [0.43, 0.49, 0.54], hair);
  cube(head, "hair-side-left", [0.22, 0.65, 0.95], [-0.68, 0.26, -0.03], hair);
  cube(head, "hair-side-right", [0.22, 0.48, 0.9], [0.68, 0.3, -0.05], hair);

  const eyes = [];
  const brows = [];
  for (const side of [-1, 1]) {
    const eye = pivot(head, side < 0 ? "left-eye" : "right-eye", [side * 0.34, 0.08, 0.575]);
    cube(eye, "eye-white", [0.34, 0.38, 0.085], [0, 0, 0], white);
    cube(eye, "eye-pupil", [0.13, 0.2, 0.055], [0.035, -0.015, 0.07], pupil);
    eyes.push(eye);

    const brow = pivot(head, side < 0 ? "left-brow" : "right-brow", [side * 0.34, 0.34, 0.59]);
    cube(brow, "eyebrow", [0.43, 0.105, 0.09], [0, 0, 0], browMaterial);
    brows.push(brow);
  }

  cube(head, "nose", [0.2, 0.24, 0.2], [0, -0.16, 0.66], skin);
  const mouth = cube(head, "mouth", [0.38, 0.12, 0.07], [0, -0.48, 0.585], mouthMaterial);
  mouth.userData.restScaleY = mouth.scale.y;

  const arms = [];
  const forearms = [];
  for (const side of [-1, 1]) {
    const arm = pivot(root, side < 0 ? "left-shoulder" : "right-shoulder", [side * 0.79, 2.55, 0]);
    cube(arm, "hoodie-upper-arm", [0.44, 0.98, 0.52], [0, -0.47, 0], hoodie);
    const elbow = pivot(arm, "elbow-pivot", [0, -0.86, 0]);
    cube(elbow, "hoodie-forearm", [0.42, 0.82, 0.47], [0, -0.38, 0], hoodie);
    cube(elbow, "hand", [0.34, 0.34, 0.38], [0, -0.91, 0.025], skin);
    arms.push(arm);
    forearms.push(elbow);
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = pivot(root, side < 0 ? "left-hip" : "right-hip", [side * 0.36, 1.25, 0]);
    cube(leg, "pants-leg", [0.5, 1.02, 0.54], [0, -0.45, 0], pants);
    cube(leg, "shoe", [0.6, 0.25, 0.82], [0, -1.03, 0.1], shoe);
    legs.push(leg);
  }

  const baseY = root.position.y;
  function update({ elapsed = 0, beat = {} } = {}) {
    const time = Math.max(0, Number.isFinite(Number(elapsed)) ? Number(elapsed) : 0);
    const mood = beat?.mood || "calm";
    // Every animated transform is assigned from absolute timeline time. A paused
    // preview therefore holds the exact pose, and seeking reconstructs it directly.
    const active = time > 0.001;
    const energy = mood === "chaos" ? 1.35 : mood === "shock" ? 1.15 : mood === "warning" ? 0.95 : 0.7;
    const talk = 0.5 + 0.5 * Math.sin(time * 9.2);
    const bob = active ? Math.sin(time * 2.5) * 0.065 : 0;
    root.position.y = baseY + bob;
    head.rotation.y = active ? Math.sin(time * 1.2) * 0.11 : 0;
    head.rotation.z = active ? Math.sin(time * 2.1) * 0.035 : 0;
    mouth.scale.y = active ? 0.35 + talk * 1.35 : mouth.userData.restScaleY;

    const blinkPhase = (time * 0.73) % (Math.PI * 2);
    const blink = active && Math.sin(blinkPhase) > 0.985 ? 0.08 : 1;
    eyes.forEach((eye) => { eye.scale.y = blink; });

    const expression = mood === "shock" ? -0.2 : mood === "chaos" ? 0.14 : mood === "warning" ? -0.1 : 0;
    brows.forEach((brow, index) => {
      brow.rotation.z = active ? expression * (index === 0 ? 1 : -1) : 0;
    });
    arms.forEach((arm, index) => {
      const side = index === 0 ? -1 : 1;
      const gesture = active ? Math.sin(time * 2.9 + index * 1.1) * 0.16 * energy : 0;
      arm.rotation.z = side * (active ? 0.06 + gesture : 0);
      arm.rotation.x = active ? Math.sin(time * 2.2 + index) * 0.12 : 0;
      forearms[index].rotation.z = active ? -0.18 - gesture * 0.4 : -0.08;
    });
    legs.forEach((leg, index) => {
      leg.rotation.x = active ? Math.sin(time * 2.9 + index * Math.PI) * 0.055 : 0;
    });
  }

  return { root, head, mouth, eyes, brows, arms, forearms, legs, update };
}
