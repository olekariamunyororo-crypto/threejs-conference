/**
 * First-person weapon viewmodel — Benelli only (gun + bundled hands).
 * No separate arms.glb.
 */

import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const VIEWMODEL_URLS = [
  "/models/benelli_m4.glb",
  "/models/benelli.glb",
];

const M4_URLS = ["/models/m4.glb", "/models/M4.glb", "/m4.glb"];

const REST = {
  position: new THREE.Vector3(0.22, -0.22, -0.48),
  rotation: new THREE.Euler(0.04, 0.06, 0.02),
  scale: 1,
};

const VIEWMODEL_TARGET_SIZE = 0.55;
const GUN_TARGET_SIZE = 0.85;

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
    object.scale.setScalar(targetSize / longest);

    object.updateMatrixWorld(true);
    box.setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);
  }

  function prepareMeshes(object) {
    const names = [];
    object.traverse((c) => {
      if (!c.isMesh) return;
      names.push(
        `${c.name || "(unnamed)"}${c.isSkinnedMesh ? " [skinned]" : ""}`,
      );
      c.visible = true;
      c.castShadow = false;
      c.receiveShadow = false;
      c.frustumCulled = false;
      c.renderOrder = 999;

      // Skinned hands break if we strip skinning — keep original mats on skin
      if (c.isSkinnedMesh) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          if (!m) return;
          m.depthTest = true;
          m.depthWrite = true;
          m.side = m.side ?? THREE.FrontSide;
          // Unlit-ish so camera-attached hands aren't pure black
          if ("emissive" in m && m.color) {
            try {
              m.emissive = m.color.clone();
              m.emissiveIntensity = 0.35;
            } catch {
              /* ignore */
            }
          }
        });
        return;
      }

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
    console.info("[weapon-view] Meshes:", names.join(", "));
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
    } else if (gltf.animations[0]) {
      // Play first clip so skinned hands aren't in a collapsed bind pose
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

    const vm = await tryLoad(loader, VIEWMODEL_URLS);
    if (vm) {
      model = vm.gltf.scene;
      prepareMeshes(model);
      fitObject(model, VIEWMODEL_TARGET_SIZE);

      // Barrel forward (away from player), stock toward player
      model.rotation.y += Math.PI;

      model.position.y -= 0.02;
      model.position.z += 0.04;
      pivot.add(model);
      setupAnimations(vm.gltf, model);
      loaded = true;
      console.info("[weapon-view] Loaded Benelli viewmodel", vm.url);
      return;
    }

    const gunResult = await tryLoad(loader, M4_URLS);
    if (gunResult) {
      model = gunResult.gltf.scene;
      prepareMeshes(model);
      fitObject(model, GUN_TARGET_SIZE);
      model.rotation.y += Math.PI;
      model.position.z += 0.02;
      pivot.add(model);
      console.info("[weapon-view] Loaded gun (no arms)", gunResult.url);
    } else {
      console.warn("[weapon-view] No gun GLB — procedural");
      model = buildFallbackGun();
      pivot.add(model);
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
