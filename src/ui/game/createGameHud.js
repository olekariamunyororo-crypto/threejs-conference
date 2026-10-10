import "./gameHud.css";

export function createGameHud({ onRespawn } = {}) {
  const root = document.createElement("div");
  root.className = "fps-game-hud";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="fps-game-hud__damage" data-damage></div>
    <div class="fps-game-hud__hitmarker" data-hitmarker></div>
    <div class="fps-game-hud__score">
      <div class="fps-game-hud__score-item">
        <span class="fps-game-hud__score-label">Kills</span>
        <span class="fps-game-hud__score-value" data-kills>0</span>
      </div>
      <div class="fps-game-hud__score-item">
        <span class="fps-game-hud__score-label">Alive</span>
        <span class="fps-game-hud__score-value" data-alive>0</span>
      </div>
    </div>
    <div class="fps-game-hud__vitals">
      <div class="fps-game-hud__bar-row">
        <span class="fps-game-hud__bar-label">HP</span>
        <div class="fps-game-hud__bar-track">
          <div class="fps-game-hud__bar-fill fps-game-hud__bar-fill--hp" data-hp-fill></div>
        </div>
        <span class="fps-game-hud__bar-value" data-hp-val>100</span>
      </div>
      <div class="fps-game-hud__bar-row">
        <span class="fps-game-hud__bar-label">ARM</span>
        <div class="fps-game-hud__bar-track">
          <div class="fps-game-hud__bar-fill fps-game-hud__bar-fill--armor" data-armor-fill></div>
        </div>
        <span class="fps-game-hud__bar-value" data-armor-val>0</span>
      </div>
    </div>
    <div class="fps-game-hud__ammo">
      <div class="fps-game-hud__ammo-mag" data-ammo-mag>30</div>
      <div class="fps-game-hud__ammo-reserve">/ <span data-ammo-reserve>120</span></div>
      <div class="fps-game-hud__ammo-weapon" data-weapon-name>Neon Rifle</div>
      <div class="fps-game-hud__reload" data-reload>Reloading…</div>
    </div>
    <div class="fps-game-hud__death" data-death>
      <div class="fps-game-hud__death-title">DOWNED</div>
      <div class="fps-game-hud__death-sub">Neural link severed — reconnect to continue</div>
      <button type="button" class="fps-game-hud__death-btn" data-respawn>Respawn</button>
    </div>
  `;
  document.body.appendChild(root);

  const els = {
    damage: root.querySelector("[data-damage]"),
    hitmarker: root.querySelector("[data-hitmarker]"),
    kills: root.querySelector("[data-kills]"),
    alive: root.querySelector("[data-alive]"),
    hpFill: root.querySelector("[data-hp-fill]"),
    hpVal: root.querySelector("[data-hp-val]"),
    armorFill: root.querySelector("[data-armor-fill]"),
    armorVal: root.querySelector("[data-armor-val]"),
    ammoMag: root.querySelector("[data-ammo-mag]"),
    ammoReserve: root.querySelector("[data-ammo-reserve]"),
    weaponName: root.querySelector("[data-weapon-name]"),
    reload: root.querySelector("[data-reload]"),
    death: root.querySelector("[data-death]"),
    respawnBtn: root.querySelector("[data-respawn]"),
  };

  let damageFlashTimer = 0;
  let hitmarkerTimer = 0;

  els.respawnBtn.addEventListener("click", (e) => {
    e.preventDefault();
    onRespawn?.();
  });

  function setVisible(visible) {
    root.classList.toggle("is-visible", Boolean(visible));
    root.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function showHitmarker() {
    hitmarkerTimer = 0.2;
    els.hitmarker.classList.remove("is-active");
    void els.hitmarker.offsetWidth;
    els.hitmarker.classList.add("is-active");
  }

  function showDamageFlash() {
    damageFlashTimer = 0.35;
    els.damage.classList.add("is-active");
  }

  function sync(playerState, weapon, aliveEnemies) {
    const hpRatio = playerState.health / playerState.maxHealth;
    const armorRatio = playerState.armor / playerState.maxArmor;
    els.hpFill.style.transform = `scaleX(${Math.max(0, hpRatio)})`;
    els.hpVal.textContent = String(Math.ceil(playerState.health));
    els.armorFill.style.transform = `scaleX(${Math.max(0, armorRatio)})`;
    els.armorVal.textContent = String(Math.ceil(playerState.armor));
    const ammo = weapon.getAmmoDisplay();
    els.ammoMag.textContent = String(ammo.mag);
    els.ammoMag.classList.toggle("is-low", ammo.mag <= Math.ceil(ammo.magSize * 0.25));
    els.ammoReserve.textContent = String(ammo.reserve);
    els.weaponName.textContent = weapon.cfg.name;
    els.reload.classList.toggle("is-active", weapon.isReloading());
    els.kills.textContent = String(playerState.kills);
    els.alive.textContent = String(aliveEnemies);
    els.death.classList.toggle("is-active", !playerState.alive);
  }

  function update(delta) {
    if (damageFlashTimer > 0) {
      damageFlashTimer -= delta;
      if (damageFlashTimer <= 0) els.damage.classList.remove("is-active");
    }
    if (hitmarkerTimer > 0) {
      hitmarkerTimer -= delta;
      if (hitmarkerTimer <= 0) els.hitmarker.classList.remove("is-active");
    }
  }

  function destroy() {
    root.remove();
  }

  return { root, setVisible, sync, update, showHitmarker, showDamageFlash, destroy };
}
