import "./shootButton.css";

const CROSSHAIR_SVG = `
<svg class="fps-shoot-btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/>
  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
  <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.25" opacity="0.5"/>
</svg>
`;

export function createShootButton({
  onFireStart,
  onFireEnd,
  hideOnDesktop = false,
} = {}) {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "fps-shoot-btn";
  root.setAttribute("aria-label", "Shoot");
  root.setAttribute("data-ui-block-look", "true");
  if (hideOnDesktop) root.classList.add("is-desktop-hidden");
  root.innerHTML = `
    <span class="fps-shoot-btn__ring"></span>
    ${CROSSHAIR_SVG}
    <span class="fps-shoot-btn__label">Fire</span>
  `;
  document.body.appendChild(root);

  let visible = false;
  let pressed = false;
  let activePointerId = null;

  function setPressed(next) {
    pressed = Boolean(next);
    root.classList.toggle("is-pressed", pressed);
  }

  function startFire(pointerId) {
    if (pressed) return;
    activePointerId = pointerId ?? null;
    setPressed(true);
    onFireStart?.();
  }

  function endFire() {
    if (!pressed) return;
    activePointerId = null;
    setPressed(false);
    onFireEnd?.();
  }

  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    root.setPointerCapture?.(e.pointerId);
    startFire(e.pointerId);
  }

  function onPointerUp(e) {
    if (activePointerId != null && e.pointerId !== activePointerId) return;
    e.preventDefault();
    e.stopPropagation();
    endFire();
  }

  function onPointerCancel() {
    endFire();
  }

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerCancel);
  root.addEventListener("lostpointercapture", onPointerCancel);
  root.addEventListener("contextmenu", (e) => e.preventDefault());

  function setVisible(next) {
    visible = Boolean(next);
    root.classList.toggle("is-visible", visible);
    if (!visible) endFire();
  }

  function destroy() {
    endFire();
    root.remove();
  }

  return {
    root,
    setVisible,
    destroy,
    isPressed: () => pressed,
  };
}
