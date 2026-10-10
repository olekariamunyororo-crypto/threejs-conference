/**
 * Simple cyberpunk drone enemies.
 * Patrol / chase AI, take damage, die with a short flash, then respawn.
 */

import * as THREE from "three/webgpu";

const ENEMY_DEFAULTS = {
  count: 8,
  health: 80,
  speed: 2.8,
  chaseSpeed: 4.2,
  aggroRange: 28,
  attackRange: 14,
  attackDamage: 12,
  attackCooldown: 1.4,
  respawnDelay: 5,
  bodyRadius: 0.55,
  bodyHeight: 1.6,
  eyeHeight: 1.4,
};

function randomInAnnulus(minR, maxR) {
  const a = Math.random() * Math.PI * 2;
  const r = minR + Math.random() * (maxR - minR);
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

export function createEnemies({
  scene,
  spawnCenter = new THREE.Vector3(0, 0, 0),
  spawnRadius = { min: 8, max: 35 },
  settings: settingsOverrides = {},
} = {}) {
  const cfg = { ...ENEMY_DEFAULTS, ...settingsOverrides };

  const group = new THREE.Group();
  group.name = "fps-enemies";
  scene.add(group);

  const enemies = [];
  const hitTargets = [];
  const _toPlayer = new THREE.Vector3();
  const _move = new THREE.Vector3();

  const bodyMat = new THREE.MeshStandardNodeMaterial({
    color: 0xff2d6a,
    emissive: 0x440011,
    roughness: 0.45,
    metalness: 0.6,
  });
  const eyeMat = new THREE.MeshStandardNodeMaterial({
    color: 0x22d3ee,
    emissive: 0x22d3ee,
    emissiveIntensity: 2,
    roughness: 0.2,
    metalness: 0.1,
  });
  const deadMat = new THREE.MeshStandardNodeMaterial({
    color: 0x333333,
    emissive: 0x000000,
    roughness: 0.9,
    metalness: 0.1,
  });

  function buildMesh() {
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(cfg.bodyRadius, cfg.bodyHeight - cfg.bodyRadius * 2, 4, 8),
      bodyMat,
    );
    body.position.y = cfg.bodyHeight * 0.5;
    body.castShadow = true;
    root.add(body);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), eyeMat);
    eye.position.set(0, cfg.eyeHeight, cfg.bodyRadius * 0.75);
    root.add(eye);

    root.userData.isEnemy = true;
    root.userData.bodyMesh = body;
    root.userData.eyeMesh = eye;
    return root;
  }

  function spawnPosition() {
    const { x, z } = randomInAnnulus(spawnRadius.min, spawnRadius.max);
    return new THREE.Vector3(spawnCenter.x + x, spawnCenter.y, spawnCenter.z + z);
  }

  for (let i = 0; i < cfg.count; i++) {
    const mesh = buildMesh();
    const pos = spawnPosition();
    mesh.position.set(pos.x, 0, pos.z);
    group.add(mesh);

    const enemy = {
      id: i,
      mesh,
      health: cfg.health,
      maxHealth: cfg.health,
      alive: true,
      state: "patrol",
      attackTimer: Math.random() * cfg.attackCooldown,
      respawnTimer: 0,
      flashTimer: 0,
      patrolTarget: spawnPosition(),
      velocity: new THREE.Vector3(),
    };
    mesh.userData.enemyId = i;
    enemies.push(enemy);
    hitTargets.push(mesh);
  }

  function findEnemyByObject(obj) {
    let node = obj;
    while (node) {
      if (node.userData?.enemyId != null) return enemies[node.userData.enemyId] ?? null;
      node = node.parent;
    }
    return null;
  }

  function damageEnemy(enemy, amount) {
    if (!enemy || !enemy.alive) return false;
    enemy.health -= amount;
    enemy.flashTimer = 0.1;
    enemy.mesh.userData.bodyMesh.material = deadMat;
    if (enemy.health <= 0) {
      killEnemy(enemy);
      return true;
    }
    return false;
  }

  function killEnemy(enemy) {
    enemy.alive = false;
    enemy.state = "dead";
    enemy.respawnTimer = cfg.respawnDelay;
    enemy.mesh.userData.bodyMesh.material = deadMat;
    enemy.mesh.userData.eyeMesh.visible = false;
    enemy.mesh.position.y = -0.3;
  }

  function respawnEnemy(enemy) {
    const pos = spawnPosition();
    enemy.mesh.position.set(pos.x, 0, pos.z);
    enemy.health = enemy.maxHealth;
    enemy.alive = true;
    enemy.state = "patrol";
    enemy.attackTimer = cfg.attackCooldown;
    enemy.patrolTarget = spawnPosition();
    enemy.mesh.userData.bodyMesh.material = bodyMat;
    enemy.mesh.userData.eyeMesh.visible = true;
  }

  function update(delta, playerPosition) {
    let damageToPlayer = 0;
    for (const enemy of enemies) {
      if (!enemy.alive) {
        enemy.respawnTimer -= delta;
        if (enemy.respawnTimer <= 0) respawnEnemy(enemy);
        continue;
      }
      if (enemy.flashTimer > 0) {
        enemy.flashTimer -= delta;
        if (enemy.flashTimer <= 0) enemy.mesh.userData.bodyMesh.material = bodyMat;
      }
      _toPlayer.subVectors(playerPosition, enemy.mesh.position);
      _toPlayer.y = 0;
      const dist = _toPlayer.length();
      if (dist < cfg.attackRange) enemy.state = "attack";
      else if (dist < cfg.aggroRange) enemy.state = "chase";
      else enemy.state = "patrol";

      if (enemy.state !== "patrol" && dist > 0.1) {
        _toPlayer.normalize();
        enemy.mesh.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
      }

      if (enemy.state === "chase" || enemy.state === "attack") {
        if (dist > 1.2) {
          _toPlayer.normalize();
          const spd = enemy.state === "attack" ? cfg.speed : cfg.chaseSpeed;
          enemy.mesh.position.x += _toPlayer.x * spd * delta;
          enemy.mesh.position.z += _toPlayer.z * spd * delta;
        }
        if (enemy.state === "attack") {
          enemy.attackTimer -= delta;
          if (enemy.attackTimer <= 0 && dist < cfg.attackRange) {
            damageToPlayer += cfg.attackDamage;
            enemy.attackTimer = cfg.attackCooldown;
          }
        }
      } else {
        _move.subVectors(enemy.patrolTarget, enemy.mesh.position);
        _move.y = 0;
        if (_move.lengthSq() < 1) enemy.patrolTarget = spawnPosition();
        else {
          _move.normalize();
          enemy.mesh.position.x += _move.x * cfg.speed * 0.5 * delta;
          enemy.mesh.position.z += _move.z * cfg.speed * 0.5 * delta;
          enemy.mesh.rotation.y = Math.atan2(_move.x, _move.z);
        }
      }
    }
    return { damageToPlayer };
  }

  function getAliveCount() {
    return enemies.filter((e) => e.alive).length;
  }

  function dispose() {
    scene.remove(group);
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    bodyMat.dispose();
    eyeMat.dispose();
    deadMat.dispose();
  }

  return {
    group,
    enemies,
    hitTargets,
    findEnemyByObject,
    damageEnemy,
    update,
    getAliveCount,
    dispose,
    cfg,
  };
}
