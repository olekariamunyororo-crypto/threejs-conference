/**
 * First-person weapon viewmodel — parented to the camera.
 * Prefers benelli_m4.glb (gun + hands), then m4 + arms, then procedural.
 */

import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const VIEWMODEL_URLS = [
  "/models/benelli_m4.glb",
  "/models/benelli.glb",
];

const M4_URLS = ["/models/m4.glb", "/models/M4.glb", "/m4.glb"];
const ARMS_URLS = ["/models/arms.glb", "/models/fp-arms.glb", "/arms.glb"];

/** Lower-right, small so it never fills the FOV. */
const REST = {
  position: new THREE.Vector3(0.25, -0.28, -0.55),
  rotation: new THREE.Euler(0.05, 0.08, 0.03),
  scale: 1,
};

/** Benelli was huge — keep this small. */
const VIEWMODEL_TARGET_SIZE = 0.35;
const GUN_TARGET_SIZE = 0.7;
const ARMS_TARGET_SIZE = 0.4;

const ARMS_POSE = {
  position: new THREE.Vector3(0.05, -0.12, 0.15),
  rotation: new THREE.Euler(0.15, 0.0, 0.0),
};

const RECOIL = {
  kickZ: 0.04,
  kickX: -0.03,
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
  let arms = null;
  let mixer = null;
  let actions = {};
  let loaded = false;
  let recoilZ = 0;
  let recoilX = 0;
  let bobPhase = 0;
  let visible = true;

  function buildFallbackGun() {
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

    return g;
  }

  function fitObject(object, targetSize) {
    object.scale.set(1, 1, 1);
    object.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z, 0.001);
    const s = targetSize / longest;
    object.scale.setScalar(s);

    object.updateMatrixWorld(true);
    box.setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);
  }

  function prepareMeshes(object) {
    object.traverse((c) => {
      if (!c.isMesh) return;
      c.castShadow = false;
      c.receiveShadow = false;
      c.frustumCulled = false;
      c.renderOrder = 999;

      const mats = Array.isArray(c.material) ? c.material : [c.material];
      const next = mats.map((m) => {
        if (!m) return m;
        try {
          const basic = new THREE.MeshBasicNodeMaterial();
          if (m.map) basic.map = m.map;
          if (m.color) basic.color = m.color.clone?.() ?? m.color;
          else basic.color = new THREE.Color(0x888888);
          if (m.transparent != null) basic.transparent = m.transparent;
          if (m.opacity != null) basic.opacity = m.opacity;
          if (m.side != null) basic.side = m.side;
          basic.depthTest = true;
          basic.depthWrite = true;
          return basic;
        } catch {
          return m;
        }
      });
      c.material = Array.isArray(c.material) ? next : next[0];
    });
  }

  function setupAnimations(gltf, scene) {
    if (!gltf.animations?.length) return;
    mixer = new THREE.AnimationMixer(scene);
    for (const clip of gltf.animations) {
      const name = clip.name.toLowerCase();
      actions[name] = mixer.clipAction(clip);
    }
    const idleKey = Object.keys(actions).find(
      (k) =>
        k.includes("idle") ||
        k.includes("rest") ||
        k.includes("hold") ||
        k.includes("draw"),
    );
    if (idleKey) {
      actions[idleKey].play();
    }
    console.info(
      "[weapon-view] Animations:",
      gltf.animations.map((c) => c.name).join(", "),
    );
  }

  function playAnim(hint) {
    if (!mixer) return;
    const key = Object.keys(actions).find((k) => k.includes(hint));
    if (!key) return;
    const action = actions[key];
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
  }

  async function makeLoader() {
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
    return loader;
  }

  async function tryLoad(loader, urls) {
    for (const url of urls) {
      try {
        const gltf = await loader.loadAsync(url);
        return { gltf, url };
      } catch {
        /* next */
      }
    }
    return null;
  }

  async function load() {
    const loader = await makeLoader();

    const vm = await tryLoad(loader, VIEWMODEL_URLS);
    if (vm) {
      model = vm.gltf.scene;
      prepareMeshes(model);
      fitObject(model, VIEWMODEL_TARGET_SIZE);

      // Spin 180° — stock to player, barrel forward
      model.rotation.y += Math.PI;

      model.position.y -= 0.05;
      model.position.z += 0.08;
      pivot.add(model);
      setupAnimations(vm.gltf, model);
      loaded = true;
      console.info("[weapon-view] Loaded viewmodel", vm.url);
    }

    if (!model) {
      const gunResult = await tryLoad(loader, M4_URLS);
      if (gunResult) {
        model = gunResult.gltf.scene;
        prepareMeshes(model);
        fitObject(model, GUN_TARGET_SIZE);

        // Spin 180° — stock to player, barrel forward
        model.rotation.y += Math.PI;

        model.position.z += 0.02;
        pivot.add(model);
        console.info("[weapon-view] Loaded gun", gunResult.url);
      } else {
        console.warn("[weapon-view] No gun GLB — procedural");
        model = buildFallbackGun();
        pivot.add(model);
      }
    }

    // Always try to show arms
    const armsResult = await tryLoad(loader, ARMS_URLS);
    if (armsResult) {
      arms = armsResult.gltf.scene;
      prepareMeshes(arms);
      fitObject(arms, ARMS_TARGET_SIZE);
      arms.position.add(ARMS_POSE.position);
      arms.rotation.x += ARMS_POSE.rotation.x;
      arms.rotation.y += ARMS_POSE.rotation.y;
      arms.rotation.z += ARMS_POSE.rotation.z;
      pivot.add(arms);
      console.info("[weapon-view] Loaded arms", armsResult.url);
    }

    loaded = true;
  }

  const loadPromise = load();

  function kick() {
    recoilZ += RECOIL.kickZ;
    recoilX += RECOIL.kickX * (0.8 + Math.random() * 0.4);
    playAnim("fire");
    playAnim("shoot");
    playAnim("attack");
  }

  function setVisible(v) {
    visible = Boolean(v);
    root.visible = visible;
  }

  function update(delta, { moving = false, sprinting = false } = {}) {
    if (!visible) return;

    if (mixer) mixer.update(delta);

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
    mixer?.stopAllAction();
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
    playAnim,
  };
}
