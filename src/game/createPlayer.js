/**
 * Player combat state: health, armor, ammo, invulnerability frames.
 * Pure data + methods — no rendering.
 */

const DEFAULTS = {
  maxHealth: 100,
  maxArmor: 50,
  invulnDuration: 0.6,
  regenDelay: 6,
  regenPerSecond: 4,
};

export function createPlayer(overrides = {}) {
  const cfg = { ...DEFAULTS, ...overrides };

  const state = {
    health: cfg.maxHealth,
    maxHealth: cfg.maxHealth,
    armor: 0,
    maxArmor: cfg.maxArmor,
    alive: true,
    invulnTimer: 0,
    timeSinceDamage: 0,
    kills: 0,
    deaths: 0,
  };

  function takeDamage(amount) {
    if (!state.alive || state.invulnTimer > 0 || amount <= 0) {
      return 0;
    }

    let remaining = amount;
    if (state.armor > 0) {
      const absorbed = Math.min(state.armor, remaining * 0.6);
      state.armor = Math.max(0, state.armor - absorbed);
      remaining -= absorbed;
    }

    state.health = Math.max(0, state.health - remaining);
    state.invulnTimer = cfg.invulnDuration;
    state.timeSinceDamage = 0;

    if (state.health <= 0) {
      state.alive = false;
      state.deaths += 1;
    }

    return amount - remaining + (amount > remaining ? remaining : 0);
  }

  function heal(amount) {
    if (!state.alive) return;
    state.health = Math.min(state.maxHealth, state.health + amount);
  }

  function addArmor(amount) {
    state.armor = Math.min(state.maxArmor, state.armor + amount);
  }

  function respawn() {
    state.health = state.maxHealth;
    state.armor = 0;
    state.alive = true;
    state.invulnTimer = 1.5;
    state.timeSinceDamage = 0;
  }

  function registerKill() {
    state.kills += 1;
  }

  function update(delta) {
    if (!state.alive) return;

    if (state.invulnTimer > 0) {
      state.invulnTimer = Math.max(0, state.invulnTimer - delta);
    }

    state.timeSinceDamage += delta;

    if (
      state.timeSinceDamage >= cfg.regenDelay &&
      state.health < state.maxHealth
    ) {
      state.health = Math.min(
        state.maxHealth,
        state.health + cfg.regenPerSecond * delta,
      );
    }
  }

  return {
    state,
    takeDamage,
    heal,
    addArmor,
    respawn,
    registerKill,
    update,
    isAlive: () => state.alive,
    getHealthRatio: () => state.health / state.maxHealth,
  };
}
