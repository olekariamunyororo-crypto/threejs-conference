/**
 * First-person M4 + left arm grip — parented to the camera.
 */

import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const M4_URLS = [
  "/models/m4.glb",
  "/models/M4.glb",
  "/m4.glb",
  "/weapons/m4.glb",
];

const REST = {
  position: new THREE.Vector3(0.22, -0.24, -0.40),
  rotation: new THREE.Euler(0.06, 0.08, 0.04),
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
   * Compact left-hand grip only — sleeve peeks from bottom-left,
   * glove rests on the handguard. Kept small so it never fills the FOV.
   */
  function buildLeftArm() {
    const arm = new THREE.Group();
    arm.name = "fp-left-arm";

    const sleeveMat = new THREE.MeshBasicNodeMaterial({ color: 0x3a4555 });
    const gloveMat = new THREE.MeshBasicNodeMaterial({ color: 0x1c222b });
    const accentMat = new THREE.MeshBasicNodeMaterial({ color: 0x5a4a2a }); // watch band

    // Forearm sleeve — short segment coming from bottom-left toward the gun
    const sleeve = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.028, 0.11, 4, 8),
      sleeveMat,
    );
    sleeve.rotation.z = 1.15;
    sleeve.rotation.x = 0.35;
    sleeve.position.set(-0.12, -0.09, 0.02);
    arm.add(sleeve);

    // Wrist / cuff
    const cuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.03, 0.008, 6, 10),
      accentMat,
    );
    cuff.rotation.y = Math.PI / 2;
    cuff.position.set(-0.02, -0.05, -0.04);
    arm.add(cuff);

    // Palm on handguard
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.03, 0.07),
      gloveMat,
    );
    palm.position.set(0.04, -0.035, -0.10);
    palm.rotation.x = -0.2;
    palm.rotation.z = -0.35;
    palm.rotation.y = 0.15;
    arm.add(palm);

    // Four fingers over the rail
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.007, 0.028, 3, 6),
        gloveMat,
      );
      finger.position.set(0.02 + i * 0.014, -0.015, -0.145);
      finger.rotation.x = 1.1;
      finger.rotation.z = -0.1;
      arm.add(finger);
    }

    // Thumb along the side
    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.008, 0.025, 3, 6),
      gloveMat,
    );
    thumb.position.set(-0.01, -0.02, -0.09);
    thumb.rotation.y = 0.9;
    thumb.rotation.x = 0.4;
    arm.add(thumb);

    return arm;
  }

  function fitModel(object) {
    object.rotation.copy(GLB_ORIENT);

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z, 0.001);
    const s = 0.8 / longest;
    object.scale.setScalar(s * REST.scale);

    box.setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);

    object.position.z += 0.02;
    object.position.y -= 0.01;
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
