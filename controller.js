import { keys, pressAction } from "./input.js";

const holds = new Map();
let pad = null;
let useButton = null;
let enabled = false;

const ICON = {
  left: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 5.1 3.3 12l6.9 6.9v-4.1h9.4V9.2h-9.4V5.1z" fill="currentColor"/></svg>`,
  right: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13.8 5.1 6.9 6.9-6.9 6.9v-4.1H4.4V9.2h9.4V5.1z" fill="currentColor"/></svg>`,
  interact: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.8 11V6.8a1.35 1.35 0 0 1 2.7 0V10h.65V4.9a1.35 1.35 0 0 1 2.7 0V10h.65V6a1.35 1.35 0 0 1 2.7 0v4.7h.65V8.2a1.35 1.35 0 0 1 2.7 0v5.3c0 4.5-2.7 7.2-7.2 7.2h-1.1c-2.2 0-3.7-.8-4.9-2.4l-3-4a1.55 1.55 0 0 1 2.4-1.95L7.8 13.5V11z" fill="currentColor"/></svg>`,
  attack: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19.7 2.8-6.1 1.5-7.9 9.2 2.4 2.4 9.2-7.9 1.5-6.1.9.9z" fill="currentColor"/><path d="m5.3 14.2 4.5 4.5-1.7 1.7-1.4-1.4-3 3-2-2 3-3-1.1-1.1 1.7-1.7z" fill="currentColor"/></svg>`,
};

function preferTouch() {
  const param = new URLSearchParams(location.search).get("touch");
  if (param === "1" || param === "true") return true;
  if (param === "0" || param === "false") return false;
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

function reservedPadHeight() {
  const buttons = pad ? [...pad.querySelectorAll("button")] : [];
  const stage =
    document.getElementById("game")?.getBoundingClientRect() || {
      bottom: window.innerHeight,
    };
  let top = stage.bottom;
  for (const button of buttons) {
    const box = button.getBoundingClientRect();
    if (box.height < 2) continue;
    top = Math.min(top, box.top);
  }
  return Math.max(72, stage.bottom - top + 16);
}

function syncLayout() {
  if (!pad) return;
  document.body.classList.toggle("touch-overlay", enabled);
  document.documentElement.style.setProperty(
    "--touch-pad-height",
    `${Math.round(reservedPadHeight())}px`,
  );
}

function syncHolds() {
  const active = new Set(holds.values());
  keys.left = active.has("left");
  keys.right = active.has("right");
  pad?.querySelectorAll("[data-hold]").forEach((button) => {
    button.classList.toggle("is-down", active.has(button.dataset.hold));
  });
}

function startHold(id, name) {
  if (name !== "left" && name !== "right") return;
  holds.set(id, name);
  syncHolds();
}

function endHold(id) {
  if (!holds.delete(id)) return;
  syncHolds();
}

function releaseAllHolds() {
  if (!holds.size) {
    if (keys.left || keys.right) {
      keys.left = keys.right = false;
      pad
        ?.querySelectorAll("[data-hold].is-down")
        .forEach((button) => button.classList.remove("is-down"));
    }
    return;
  }
  holds.clear();
  syncHolds();
}

function bindButton(button) {
  const hold = button.dataset.hold;
  const action = button.dataset.action;

  const down = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    if (navigator.vibrate) navigator.vibrate(12);
    if (hold) startHold(id, hold);
    if (action) {
      button.classList.add("is-down");
      pressAction(action);
    }
  };
  const up = () => {
    if (action) button.classList.remove("is-down");
  };

  button.addEventListener(
    "touchstart",
    (event) => {
      for (const touch of event.changedTouches)
        down(event, `t${touch.identifier}`);
    },
    { passive: false },
  );
  button.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "touch") return;
      down(event, event.pointerId);
    },
    { passive: false },
  );
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("touchend", up);
  button.addEventListener("touchcancel", up);
}

function showPad() {
  if (enabled || !pad) return;
  enabled = true;
  document.body.classList.add("touch-controls");
  syncLayout();
}

function buildPad(root) {
  pad = document.createElement("div");
  pad.id = "touchPad";
  pad.setAttribute("role", "group");
  pad.setAttribute("aria-label", "Touch controls");
  pad.innerHTML = `
    <button type="button" class="touchBtn touchDir touchMoveLeft" data-hold="left" aria-label="Walk left">${ICON.left}</button>
    <div class="touchActions">
      <button type="button" class="touchBtn touchUse" data-action="interact" aria-label="Interact">${ICON.interact}</button>
      <button type="button" class="touchBtn touchStamp" data-action="attack" aria-label="Attack">${ICON.attack}</button>
    </div>
    <button type="button" class="touchBtn touchDir touchMoveRight" data-hold="right" aria-label="Walk right">${ICON.right}</button>
  `;
  root.appendChild(pad);
  useButton = pad.querySelector(".touchUse");
  const block = (event) => event.preventDefault();
  pad.addEventListener("contextmenu", block);
  pad.addEventListener("selectstart", block);
  pad.addEventListener("dragstart", block);
  pad.addEventListener("touchstart", block, { passive: false });
  pad.querySelectorAll("button").forEach(bindButton);
}

export function usingTouchControls() {
  return enabled;
}

export function setInteractReady(ready) {
  useButton?.classList.toggle("ready", !!ready);
}

export function mountTouchControls(root = document.getElementById("stage")) {
  if (!root || pad) return;
  buildPad(root);
  if (preferTouch()) showPad();

  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") showPad();
  });
  window.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch") endHold(event.pointerId);
  }, true);
  window.addEventListener("pointercancel", (event) => {
    if (event.pointerType !== "touch") endHold(event.pointerId);
  }, true);
  window.addEventListener(
    "touchend",
    (event) => {
      for (const touch of event.changedTouches) endHold(`t${touch.identifier}`);
      if (event.touches.length === 0) releaseAllHolds();
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "touchcancel",
    () => releaseAllHolds(),
    { capture: true, passive: true },
  );
  window.addEventListener("blur", releaseAllHolds);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAllHolds();
  });
  window.addEventListener("resize", syncLayout);
  new ResizeObserver(syncLayout).observe(pad);
}
