# Enemy AI (IgnitionAI integration)

This folder adds a **TrainingEnv** that re-uses the same BVH collision logic as `createWalkControls` so enemy agents respect the cyberpunk alley geometry.

**Visible NPC:** `public/models/adam_smasher_rigged.glb` (Adam Smasher) is loaded automatically and driven by the env position / yaw. If the GLB contains Idle/Walk clips they will cross-fade.

## Files

| File | Purpose |
|------|---------|
| `EnemyTrainingEnv.js` | Implements IgnitionAI `TrainingEnv` (observe / step / reward / done / reset) |
| `setupEnemyAI.js` | Loads Adam Smasher, wiring helper, train/infer, per-frame `update()` |
| `README.md` | This guide |

## 1. Install (optional – only needed for RL training)

```bash
cd threejs-punk
npm install ignitionai
```

The model still appears and moves with a simple controller even without IgnitionAI.

## 2. Minimal integration (in `src/main.js` or a post-world hook)

```js
import { FEATURES } from "./world/features.js";
import { setupEnemyAI } from "./ai/setupEnemyAI.js";
import * as THREE from "three/webgpu";

// After createWorld(), buildModelBvh(), and cameraDirector exist:

if (FEATURES.trainEnemies) {
  const colliders = []; // push city, collider.glb meshes, car, etc. that have boundsTree
  // Example: world.cityRoot, world.colliderRoot, world.car

  const enemyAI = setupEnemyAI({
    camera,                    // the walk-mode camera
    scene,
    colliders,
    ground: world.ground,      // optional
    model: world.cityRoot,     // for ground probes
    spawnPoints: [
      new THREE.Vector3(5, 1.6, -15),
      new THREE.Vector3(-8, 1.6, -22),
    ],
    autoTrain: false,          // set true to start DQN immediately
  });

  // In the render / animation loop:
  // enemyAI.update(delta);
}
```

Enable the flag:

```js
// src/world/features.js
trainEnemies: true,
```

## 3. Adam Smasher asset

- Path: `public/models/adam_smasher_rigged.glb`
- Loaded via the same GLTFLoader pattern used by the rest of the project
- Position + yaw are driven every frame from `EnemyTrainingEnv`
- If the file contains animations named `Idle` / `Walk` (case-insensitive) they are cross-faded when the agent moves

Scale / facing can be adjusted in `setupEnemyAI.js` (`root.scale`, `root.rotation.y` offset) if the model is authored differently.

## 4. How collision is shared

`EnemyTrainingEnv` ports the two key helpers from `createWalkControls.js`:

- **Ground sampling** – downward raycasts against walk targets (city + ground)
- **Wall tests** – three first-hit chest-height rays against colliders that already have `geometry.boundsTree`

## 5. Observation & action space (v1)

**Actions** (discrete):  
`forward | back | strafe_left | strafe_right | turn_left | turn_right | shoot | idle`

**Observation** (9 floats):  
relative xz, distance, sin/cos yaw, relative bearing to player, health, line-of-sight, shoot-cooldown flag.

## 6. Training tips

1. Strip expensive effects while training (`FEATURES.rain = false`, disable post) so the browser stays responsive.
2. Use `ignition.setSpeed(20–50)` for turbo episodes.
3. After convergence call `startInference()` and spawn multiple enemies that share the same weights.
4. Damage the NPC from the player with `enemyAI.applyDamage(25)`.

## 7. Status

- Original walk controls, rain, and post-processing are untouched.
- Adam Smasher is only loaded when `FEATURES.trainEnemies` is true (or when you call `setupEnemyAI` yourself).
- Production path stays clean unless you flip the flag.
