/**
 * FPS game layer — player, weapon, enemies, FX, HUD, FP gun, shoot button
 */
import * as THREE from "three/webgpu";
import { createPlayer } from "./createPlayer.js";
import { createWeapon } from "./createWeapon.js";
import { createEnemies } from "./createEnemies.js";
import { createCombatFx } from "./createCombatFx.js";
import { createWeaponView } from "./createWeaponView.js";
import { createGameHud } from "../ui/game/createGameHud.js";
import { createShootButton } from "../ui/game/createShootButton.js";

export function createGame({
  scene, camera, renderer, getWalkControls, getFinishedIntro,
  spawnCenter = new THREE.Vector3(0, 0, 0),
}) {
  if (!camera.parent) scene.add(camera);

  const player = createPlayer();
  const weapon = createWeapon("neonRifle");
  const enemies = createEnemies({
    scene, spawnCenter, spawnRadius: { min: 10, max: 40 }, settings: { count: 8 },
  });
  const fx = createCombatFx({ scene, camera });
  const weaponView = createWeaponView({ camera, renderer });
  const raycaster = new THREE.Raycaster();
  const _origin = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  let active = false;
  let fireHeld = false;
  let semiFired = false;

  const hud = createGameHud({
    onRespawn: () => {
      player.respawn();
      const walk = getWalkControls?.();
      if (walk) {
        camera.position.y += 0.01;
        walk.snapCameraToGround?.();
      }
      hud.sync(player.state, weapon, enemies.getAliveCount());
      weaponView.setVisible(true);
    },
  });

  const shootBtn = createShootButton({
    onFireStart: () => {
      fireHeld = true;
      weapon.setFireHeld(true);
      if (!weapon.cfg.auto) tryShoot();
    },
    onFireEnd: () => {
      fireHeld = false;
      semiFired = false;
      weapon.setFireHeld(false);
    },
  });

  function setActive(next) {
    active = Boolean(next);
    hud.setVisible(active);
    shootBtn.setVisible(active);
    weaponView.setVisible(active && player.isAlive());
    if (active) hud.sync(player.state, weapon, enemies.getAliveCount());
  }

  function getShootRay() {
    camera.getWorldPosition(_origin);
    camera.getWorldDirection(_dir);
    raycaster.set(_origin, _dir);
    return raycaster;
  }

  function handleFireResult(hit) {
    if (!hit) return;
    const enemy = enemies.findEnemyByObject(hit.object);
    if (enemy) {
      const killed = enemies.damageEnemy(enemy, hit.damage);
      hud.showHitmarker();
      if (killed) player.registerKill();
    }
    fx.onHit({ point: hit.point, origin: _origin.clone(), direction: _dir.clone() });
  }

  function fireCallbacks() {
    return {
      onFire: (info) => {
        fx.onFire(info);
        weaponView.kick();
        const walk = getWalkControls?.();
        if (walk?.applyLookDelta) {
          const sens = walk.settings?.mouseSensitivity ?? 0.002;
          walk.applyLookDelta((info.recoilYaw ?? 0) / sens, -(info.recoilPitch ?? 0) / sens);
        }
      },
      onHit: () => {},
      onMiss: (info) => fx.onMiss({ ...info, origin: _origin.clone() }),
    };
  }

  function tryShoot() {
    if (!active || !player.isAlive() || !getFinishedIntro?.()) return;
    const walk = getWalkControls?.();
    if (walk && !walk.isPointerLocked?.() && !walk.hasTouchLooked?.() && !walk.isActive?.()) return;
    const hit = weapon.fireOnce(getShootRay(), enemies.hitTargets, fireCallbacks());
    handleFireResult(hit);
    hud.sync(player.state, weapon, enemies.getAliveCount());
  }

  function isEditable(target) {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  function onPointerDown(event) {
    if (!active || !player.isAlive() || event.button !== 0 || isEditable(event.target)) return;
    if (event.target?.closest?.(".fps-shoot-btn")) return;
    fireHeld = true;
    weapon.setFireHeld(true);
    if (!weapon.cfg.auto && !semiFired) {
      semiFired = true;
      tryShoot();
    }
  }

  function onPointerUp(event) {
    if (event.button !== 0) return;
    if (shootBtn.isPressed()) return;
    fireHeld = false;
    semiFired = false;
    weapon.setFireHeld(false);
  }

  function onKeyDown(event) {
    if (!active || isEditable(event.target)) return;
    if (event.code === "KeyR" && !event.repeat) {
      weapon.requestReload();
      event.preventDefault();
    }
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);

  function update(delta) {
    if (!active) return;
    player.update(delta);
    fx.update(delta);
    hud.update(delta);
    const walk = getWalkControls?.();
    const moving = walk?.isMoving?.() ?? false;
    const sprinting = moving && (walk?.getHorizontalSpeed?.() ?? 0) > 5;

    if (!player.isAlive()) {
      weaponView.setVisible(false);
      hud.sync(player.state, weapon, enemies.getAliveCount());
      return;
    }

    weaponView.update(delta, { moving, sprinting });

    if (fireHeld && weapon.cfg.auto) {
      const hit = weapon.update(delta, getShootRay(), enemies.hitTargets, fireCallbacks());
      if (hit) handleFireResult(hit);
    } else {
      weapon.update(delta, null, [], {});
    }

    const { damageToPlayer } = enemies.update(delta, camera.position);
    if (damageToPlayer > 0) {
      player.takeDamage(damageToPlayer);
      hud.showDamageFlash();
      if (!player.isAlive()) weaponView.setVisible(false);
    }
    hud.sync(player.state, weapon, enemies.getAliveCount());
  }

  function dispose() {
    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
    enemies.dispose();
    fx.dispose();
    weaponView.dispose();
    hud.destroy();
    shootBtn.destroy();
  }

  return { player, weapon, enemies, weaponView, setActive, update, dispose, isActive: () => active };
}
