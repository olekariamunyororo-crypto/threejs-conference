# Threejs-Punk → FPS conversion

This fork adds a **combat layer** on top of the original WebGPU cyberpunk walkthrough.

## What’s new

| System | Location | Notes |
|--------|----------|--------|
| Player health / armor / regen | `src/game/createPlayer.js` | Invuln frames, passive regen after 6s |
| Hitscan weapons | `src/game/createWeapon.js` | Neon Rifle (auto) + Plasma Pistol preset |
| Enemy drones | `src/game/createEnemies.js` | Patrol → chase → attack, respawn |
| Combat VFX | `src/game/createCombatFx.js` | Tracers, impacts, muzzle flash |
| Game HUD | `src/ui/game/createGameHud.js` | HP, armor, ammo, kills, death screen |
| FP M4 weapon view | `src/game/createWeaponView.js` | Loads `/models/m4.glb` |
| Neon pink shoot button | `src/ui/game/createShootButton.js` | Mobile-friendly fire control |
| Wiring | `src/game/createGame.js` + `main.js` | Factory pattern, feature-flagged |

## Controls

| Input | Action |
|-------|--------|
| WASD / arrows | Move |
| Mouse (pointer lock) | Look |
| **Left click** / **pink Fire button** | Fire |
| **R** | Reload |
| Shift | Sprint |
| C | Crouch |
| Click **Respawn** | After death |

## M4 model

Copy your GLB to:

```bash
mkdir -p public/models
cp ~/storage/downloads/m4.glb public/models/m4.glb
```

## Feature flag

```js
// src/world/features.js
fpsCombat: true,
gameWalk: true,
```

## Run

```bash
npm install
npm run dev
```
