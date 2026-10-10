/**
 * First-person M4 weapon view — parented to the camera.
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
  position: new THREE.Vector3(0.28, -0.26, -0.42),
  rotation: new THREE.Euler(0.02, 0, 0.04),
  scale: 1,
};

/**
 * Extra rotation applied only to loaded GLBs.
 * Y = 0 keeps authoring forward axis; previous Math.PI had the stock facing the world.
 */
const GLB_ORIENT = new THREE.Euler(0, 0, 0);

const RECOIL = {
  kickZ: 0.045,
  kickX: -0.035,
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

  function fitModel(object) {
    object.rotation.copy(GLB_ORIENT);

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z, 0.001);
    const s = 0.75 / longest;
    object.scale.setScalar(s * REST.scale);

    box.setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);

    object.position.z += 0.05;
    object.position.y -= 0.02;
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
