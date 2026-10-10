/**
 * First-person M4 + left arm grip — parented to the camera.
 * Pose tuned to look like a classic FPS hold (left hand on handguard).
 */

import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const M4_URLS = [
  "/models/m4.glb",
  "/models/M4.glb",
  "/m4.glb",
  "/weapons/m4.glb",
];

/**
 * Camera-local rest pose — gun lower-right, barrel into the world (-Z).
 * Tuned to leave room for the left arm on the left side of the frame.
 */
const REST = {
  position: new THREE.Vector3(0.18, -0.22, -0.38),
  rotation: new THREE.Euler(0.08, 0.12, 0.06),
  scale: 1,
};

const GLB_ORIENT = new THREE.Euler(0, 0, 0);

const RECOIL = {
  kickZ: 0.05,
  kickX: -0.04,
  recover: 14,
};

export function createWeaponView({ camera }) {
  const root = new THREE.Group();
  root.name = "fp-weapon";
  camera.add(root);

  const pivot = new THREE.Group();
  pivot.position.copy(REST.position);
  pivot.rotation.copy(REST.rotation);
  root.add(pivot);

  let model = null;
  let loaded = false;
  let recoilZ = 0;
  let recoilX = 0;
  let bobPhase = 0;
  let visible = true;

  // Left arm is always present (procedural)
  const leftArm = buildLeftArm();
  pivot.add(leftArm);

  function buildFallback() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicNodeMaterial({ color: 0x2a2a32 });
    const accent = new THREE.MeshBasicNodeMaterial({ color: 0xff2d6a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.6), mat);
    body.position.set(0, 0.02, 0);
    g.add(body);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.4, 8),
      mat,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.45);
    g.add(barrel);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.2), mat);
    stock.position.set(0, 0.0, 0.35);
    g.add(stock);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.09), accent);
    mag.position.set(0, -0.12, 0.05);
    g.add(mag);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.25), mat);
    handguard.position.set(0, 0.0, -0.2);
    g.add(handguard);

    return g;
  }

  /**
   * Stylized left arm: sleeve → forearm → glove hand on the handguard.
   * Coordinates are relative to the weapon pivot (gun local space).
   */
  function buildLeftArm() {
    const arm = new THREE.Group();
    arm.name = "fp-left-arm";

    // Colors matching the reference (dark sleeve, glove)
    const sleeveMat = new THREE.MeshBasicNodeMaterial({ color: 0x2c3540 });
    const gloveMat = new THREE.MeshBasicNodeMaterial({ color: 0x1a1e24 });
    const skinMat = new THREE.MeshBasicNodeMaterial({ color: 0x8d6e5a });
    const watchMat = new THREE.MeshBasicNodeMaterial({ color: 0x111111 });
    const watchFace = new THREE.MeshBasicNodeMaterial({ color: 0xc8c8c8 });

    // Upper sleeve (coming from bottom-left of camera)
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.28, 8),
      sleeveMat,
    );
    sleeve.rotation.z = Math.PI / 2;
    sleeve.rotation.y = -0.35;
    sleeve.position.set(-0.22, -0.08, 0.05);
    arm.add(sleeve);

    // Forearm
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8),
      sleeveMat,
    );
    forearm.rotation.z = Math.PI / 2;
    forearm.rotation.y = -0.15;
    forearm.position.set(-0.05, -0.06, -0.02);
    arm.add(forearm);

    // Watch on wrist
    const watch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.03, 12),
      watchMat,
    );
    watch.rotation.z = Math.PI / 2;
    watch.position.set(0.04, -0.05, -0.06);
    arm.add(watch);
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.008, 12),
      watchFace,
    );
    face.rotation.z = Math.PI / 2;
    face.position.set(0.04, -0.035, -0.06);
    arm.add(face);

    // Glove / hand gripping the handguard
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.045, 0.09),
      gloveMat,
    );
    palm.position.set(0.12, -0.04, -0.12);
    palm.rotation.y = 0.2;
    palm.rotation.z = -0.25;
    arm.add(palm);

    // Fingers curled over the rail
    const fingerGeo = new THREE.BoxGeometry(0.018, 0.025, 0.06);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(fingerGeo, gloveMat);
      f.position.set(0.1 + i * 0.018, -0.01, -0.16);
      f.rotation.x = -0.9;
      f.rotation.z = -0.15;
      arm.add(f);
    }

    // Thumb
    const thumb = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.025, 0.05),
      gloveMat,
    );
    thumb.position.set(0.08, -0.02, -0.1);
    thumb.rotation.y = 0.6;
    thumb.rotation.x = -0.3;
    arm.add(thumb);

    // Small wrist skin band between sleeve and glove
    const wrist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.02, 8),
      skinMat,
    );
    wrist.rotation.z = Math.PI / 2;
    wrist.position.set(0.02, -0.05, -0.05);
    arm.add(wrist);

    return arm;
  }

  function fitModel(object) {
    object.rotation.copy(GLB_ORIENT);

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z, 0.001);
    // Slightly larger than before so the handguard meets the hand
    const s = 0.85 / longest;
    object.scale.setScalar(s * REST.scale);

    box.setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);

    // Shift so handguard sits near the left-hand grip point
    object.position.z += 0.02;
    object.position.y -= 0.01;
    object.position.x += 0.02;
  }

  async function load() {
    const loader = new GLTFLoader();
    try {
      const { DRACOLoader } = await import(
        "three/addons/loaders/DRACOLoader.js"
      );
      const draco = new DRACOLoader();
      draco.setDecoderPath("/libs/draco/");
      loader.setDRACOLoader(draco);
    } catch {
      /* optional */
    }

    let gltf = null;
    let usedUrl = null;
    for (const url of M4_URLS) {
      try {
        gltf = await loader.loadAsync(url);
        usedUrl = url;
        break;
      } catch {
        /* next */
      }
    }

    if (gltf) {
      model = gltf.scene;
      model.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = false;
          c.receiveShadow = false;
          c.frustumCulled = false;
        }
      });
      fitModel(model);
      pivot.add(model);
      loaded = true;
      console.info("[weapon-view] Loaded", usedUrl);
      return;
    }

    console.warn("[weapon-view] m4.glb missing — procedural gun");
    model = buildFallback();
    pivot.add(model);
    loaded = true;
  }

  const loadPromise = load();

  function kick() {
    recoilZ += RECOIL.kickZ;
    recoilX += RECOIL.kickX * (0.8 + Math.random() * 0.4);
  }

  function setVisible(v) {
    visible = Boolean(v);
    root.visible = visible;
  }

  function update(delta, { moving = false, sprinting = false } = {}) {
    if (!visible) return;
    const recover = 1 - Math.exp(-delta * RECOIL.recover);
    recoilZ += (0 - recoilZ) * recover;
    recoilX += (0 - recoilX) * recover;

    const bobSpeed = sprinting ? 12 : moving ? 8 : 1.6;
    const bobAmp = sprinting ? 0.012 : moving ? 0.008 : 0.003;
    bobPhase += delta * bobSpeed;
    const bobY = Math.sin(bobPhase) * bobAmp;
    const bobX = Math.cos(bobPhase * 0.5) * bobAmp * 0.6;

    pivot.position.x = REST.position.x + bobX;
    pivot.position.y = REST.position.y + bobY + recoilX * 0.3;
    pivot.position.z = REST.position.z + recoilZ;
    pivot.rotation.x = REST.rotation.x + recoilX;
    pivot.rotation.y = REST.rotation.y;
    pivot.rotation.z = REST.rotation.z + bobX * 0.5;
  }

  function dispose() {
    camera.remove(root);
  }

  return {
    root,
    pivot,
    loadPromise,
    kick,
    setVisible,
    update,
    dispose,
    isLoaded: () => loaded,
  };
}
