/**
 * Lightweight combat VFX: tracers, impact sparks, muzzle flash.
 */

import * as THREE from "three/webgpu";

const TRACER_LIFE = 0.08;
const IMPACT_LIFE = 0.25;
const MUZZLE_LIFE = 0.05;

export function createCombatFx({ scene, camera }) {
  const root = new THREE.Group();
  root.name = "combat-fx";
  scene.add(root);

  const tracers = [];
  const impacts = [];
  let muzzleFlash = null;
  let muzzleTimer = 0;

  const tracerMat = new THREE.MeshBasicNodeMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const impactMat = new THREE.MeshBasicNodeMaterial({
    color: 0xff2d6a,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const muzzleMat = new THREE.MeshBasicNodeMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

  const tracerGeo = new THREE.CylinderGeometry(0.015, 0.008, 1, 4);
  tracerGeo.rotateX(Math.PI / 2);
  const impactGeo = new THREE.SphereGeometry(0.08, 6, 6);
  const muzzleGeo = new THREE.SphereGeometry(0.12, 6, 6);

  const _mid = new THREE.Vector3();
  const _dir = new THREE.Vector3();

  function spawnTracer(origin, end) {
    const mesh = new THREE.Mesh(tracerGeo, tracerMat.clone());
    _dir.subVectors(end, origin);
    const len = _dir.length();
    if (len < 0.01) return;
    _mid.copy(origin).addScaledVector(_dir, 0.5);
    mesh.position.copy(_mid);
    mesh.scale.set(1, 1, len);
    mesh.lookAt(end);
    root.add(mesh);
    tracers.push({ mesh, life: TRACER_LIFE, maxLife: TRACER_LIFE });
  }

  function spawnImpact(point) {
    const mesh = new THREE.Mesh(impactGeo, impactMat.clone());
    mesh.position.copy(point);
    root.add(mesh);
    impacts.push({ mesh, life: IMPACT_LIFE, maxLife: IMPACT_LIFE });
  }

  function spawnMuzzle() {
    if (!muzzleFlash) {
      muzzleFlash = new THREE.Mesh(muzzleGeo, muzzleMat);
      root.add(muzzleFlash);
    }
    muzzleTimer = MUZZLE_LIFE;
    muzzleFlash.visible = true;
  }

  function onFire({ origin, direction }) {
    spawnMuzzle();
    const stubEnd = origin.clone().addScaledVector(direction, 2.5);
    spawnTracer(origin, stubEnd);
  }

  function onHit({ point, distance, origin, direction }) {
    const start = origin ?? camera.position;
    const dir = direction ?? point.clone().sub(start).normalize();
    const from = start.clone().addScaledVector(dir, 0.8);
    spawnTracer(from, point);
    spawnImpact(point);
  }

  function onMiss({ point, direction, origin }) {
    const start = origin ?? camera.position;
    const from = start.clone().addScaledVector(direction, 0.8);
    spawnTracer(from, point);
  }

  function update(delta) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= delta;
      t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.9;
      if (t.life <= 0) {
        root.remove(t.mesh);
        t.mesh.material.dispose();
        tracers.splice(i, 1);
      }
    }
    for (let i = impacts.length - 1; i >= 0; i--) {
      const imp = impacts[i];
      imp.life -= delta;
      const t = 1 - imp.life / imp.maxLife;
      imp.mesh.scale.setScalar(1 + t * 2);
      imp.mesh.material.opacity = Math.max(0, 1 - t);
      if (imp.life <= 0) {
        root.remove(imp.mesh);
        imp.mesh.material.dispose();
        impacts.splice(i, 1);
      }
    }
    if (muzzleFlash && muzzleTimer > 0) {
      muzzleTimer -= delta;
      camera.getWorldDirection(_dir);
      muzzleFlash.position
        .copy(camera.position)
        .addScaledVector(_dir, 0.55)
        .add(camera.up.clone().multiplyScalar(-0.12));
      const right = new THREE.Vector3().crossVectors(_dir, camera.up).normalize();
      muzzleFlash.position.addScaledVector(right, 0.18);
      muzzleFlash.material.opacity = (muzzleTimer / MUZZLE_LIFE) * 0.85;
      if (muzzleTimer <= 0) muzzleFlash.visible = false;
    }
  }

  function dispose() {
    scene.remove(root);
    tracerGeo.dispose();
    impactGeo.dispose();
    muzzleGeo.dispose();
    tracerMat.dispose();
    impactMat.dispose();
    muzzleMat.dispose();
  }

  return { onFire, onHit, onMiss, update, dispose };
}
