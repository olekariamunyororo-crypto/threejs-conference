/**
 * First-person weapon viewmodel — parented to the camera.
 * Prefers benelli_m4.glb (gun + hands + anims), then m4 + arms, then procedural.
 */

import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Full viewmodels (weapon + hands in one file) — preferred. */
const VIEWMODEL_URLS = [
  "/models/benelli_m4.glb",
  "/models/benelli.glb",
];

/** Gun-only fallbacks */
const M4_URLS = ["/models/m4.glb", "/models/M4.glb", "/m4.glb"];

/** Separate arms if using gun-only model */
const ARMS_URLS = ["/models/arms.glb", "/models/fp-arms.glb", "/arms.glb"];

const REST = {
  position: new THREE.Vector3(0.18, -0.2, -0.36),
  rotation: new THREE.Euler(0.04, 0.04, 0.02),
  scale: 1,
};

const VIEWMODEL_TARGET_SIZE = 0.85;
const GUN_TARGET_SIZE = 0.75;
const ARMS_TARGET_SIZE = 0.42;

const ARMS_POSE = {
  position: new THREE.Vector3(0.05, -0.12, 0.15),
  rotation: new THREE.Euler(0.15, 0.0, 0.0),
};

const RECOIL = {
  kickZ: 0.055,
  kickX: -0.045,
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
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z, 0.001);
    object.scale.setScalar(targetSize / longest);
    box.setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);
  }

  function prepareMeshes(object) {
    object.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = false;
        c.receiveShadow = false;
        c.frustumCulled = false;
      }
    });
  }

  function setupAnimations(gltf, scene) {
    if (!gltf.animations?.length) return;
    mixer = new THREE.AnimationMixer(scene);
    for (const clip of gltf.animations) {
      const name = clip.name.toLowerCase();
      actions[name] = mixer.clipAction(clip);
      // Prefer idle / rest if present
      if (name.includes("idle") || name.includes("rest") || name.includes("hold")) {
        actions[name].play();
      }
    }
    // If nothing is playing, play the first clip looping quietly
    const playing = Object.values(actions).some((a) => a.isRunning());
    if (!playing && gltf.animations[0]) {
      const a = mixer.clipAction(gltf.animations[0]);
      a.play();
      actions[gltf.animations[0].name.toLowerCase()] = a;
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

    // 1) Preferred: full viewmodel (Benelli + hands)
    const vm = await tryLoad(loader, VIEWMODEL_URLS);
    if (vm) {
      model = vm.gltf.scene;
      prepareMeshes(model);
      fitObject(model, VIEWMODEL_TARGET_SIZE);
      model.position.z += 0.04;
      model.position.y -= 0.02;
      pivot.add(model);
      setupAnimations(vm.gltf, model);
      loaded = true;
      console.info("[weapon-view] Loaded viewmodel", vm.url);
      return;
    }

    // 2) Fallback: separate gun + arms
    const gunResult = await tryLoad(loader, M4_URLS);
    if (gunResult) {
      model = gunResult.gltf.scene;
      prepareMeshes(model);
      fitObject(model, GUN_TARGET_SIZE);
      model.position.z += 0.02;
      pivot.add(model);
      console.info("[weapon-view] Loaded gun", gunResult.url);
    } else {
      console.warn("[weapon-view] No gun GLB — procedural");
      model = buildFallbackGun();
      pivot.add(model);
    }

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
