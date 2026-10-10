/**
 * Hitscan weapon with fire rate, ammo, reload, and recoil kick.
 * Visuals (muzzle / tracer) are driven by the caller via onFire / onHit callbacks.
 */

const WEAPON_PRESETS = {
  plasmaPistol: {
    name: "Plasma Pistol",
    damage: 28,
    fireRate: 4.5,
    magazineSize: 12,
    reloadTime: 1.4,
    range: 80,
    spread: 0.012,
    recoilPitch: 0.018,
    recoilYaw: 0.008,
    auto: false,
  },
  neonRifle: {
    name: "Neon Rifle",
    damage: 18,
    fireRate: 9,
    magazineSize: 30,
    reloadTime: 1.8,
    range: 120,
    spread: 0.022,
    recoilPitch: 0.01,
    recoilYaw: 0.006,
    auto: true,
  },
};

export function createWeapon(presetName = "neonRifle", overrides = {}) {
  const preset = WEAPON_PRESETS[presetName] ?? WEAPON_PRESETS.neonRifle;
  const cfg = { ...preset, ...overrides };

  const state = {
    ammoInMag: cfg.magazineSize,
    reserveAmmo: cfg.magazineSize * 4,
    reloading: false,
    reloadTimer: 0,
    cooldown: 0,
    totalShots: 0,
    totalHits: 0,
  };

  let fireHeld = false;
  let wantReload = false;

  function canFire() {
    return !state.reloading && state.cooldown <= 0 && state.ammoInMag > 0;
  }

  function startReload() {
    if (state.reloading || state.ammoInMag >= cfg.magazineSize || state.reserveAmmo <= 0) {
      return false;
    }
    state.reloading = true;
    state.reloadTimer = cfg.reloadTime;
    return true;
  }

  function finishReload() {
    const need = cfg.magazineSize - state.ammoInMag;
    const take = Math.min(need, state.reserveAmmo);
    state.ammoInMag += take;
    state.reserveAmmo -= take;
    state.reloading = false;
    state.reloadTimer = 0;
  }

  function tryFire(raycaster, targets, callbacks = {}) {
    if (!canFire()) {
      if (state.ammoInMag <= 0 && !state.reloading) startReload();
      return null;
    }

    state.ammoInMag -= 1;
    state.cooldown = 1 / cfg.fireRate;
    state.totalShots += 1;

    const dir = raycaster.ray.direction.clone();
    dir.x += (Math.random() - 0.5) * cfg.spread;
    dir.y += (Math.random() - 0.5) * cfg.spread;
    dir.z += (Math.random() - 0.5) * cfg.spread;
    dir.normalize();
    raycaster.ray.direction.copy(dir);
    raycaster.far = cfg.range;
    raycaster.firstHitOnly = true;

    callbacks.onFire?.({
      origin: raycaster.ray.origin.clone(),
      direction: dir.clone(),
      recoilPitch: cfg.recoilPitch * (0.7 + Math.random() * 0.6),
      recoilYaw: cfg.recoilYaw * (Math.random() - 0.5) * 2,
    });

    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      const hit = hits[0];
      state.totalHits += 1;
      const result = {
        point: hit.point.clone(),
        normal: hit.face?.normal?.clone() ?? null,
        distance: hit.distance,
        object: hit.object,
        damage: cfg.damage,
      };
      callbacks.onHit?.(result);
      return result;
    }

    const missPoint = raycaster.ray.origin.clone().addScaledVector(dir, cfg.range);
    callbacks.onMiss?.({ point: missPoint, direction: dir.clone() });
    return null;
  }

  function setFireHeld(held) {
    fireHeld = Boolean(held);
  }

  function requestReload() {
    wantReload = true;
  }

  function update(delta, raycaster, targets, callbacks) {
    if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - delta);
    if (state.reloading) {
      state.reloadTimer -= delta;
      if (state.reloadTimer <= 0) finishReload();
      return null;
    }
    if (wantReload) {
      wantReload = false;
      startReload();
      return null;
    }
    if (fireHeld && cfg.auto) {
      return tryFire(raycaster, targets, callbacks);
    }
    return null;
  }

  function fireOnce(raycaster, targets, callbacks) {
    return tryFire(raycaster, targets, callbacks);
  }

  function addAmmo(magazines = 1) {
    state.reserveAmmo += cfg.magazineSize * magazines;
  }

  return {
    cfg,
    state,
    canFire,
    startReload,
    setFireHeld,
    requestReload,
    fireOnce,
    update,
    addAmmo,
    isReloading: () => state.reloading,
    getAmmoDisplay: () => ({
      mag: state.ammoInMag,
      reserve: state.reserveAmmo,
      magSize: cfg.magazineSize,
    }),
  };
}

export { WEAPON_PRESETS };
