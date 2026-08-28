import { keys, pressAction } from "./input.js";

const holds = new Map();
let pad = null;
let useButton = null;
let enabled = false;

const ICON = {
  left: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.2 4.8 7.5 12l7.7 7.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  right: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.8 4.8 16.5 12l-7.7 7.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  use: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.8h4.2a4.8 4.8 0 0 1 0 9.6H8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8 3.8v16.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12.8 17.6 16.6 12l-3.8-5.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  act: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 8.2v7.6M8.2 12h7.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
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

function syncLayout() {
  if (!pad) return;
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  document.body.classList.toggle("touch-overlay", enabled && !portrait);
  document.documentElement.style.setProperty(
    "--touch-pad-height",
    `${Math.round(pad.getBoundingClientRect().height)}px`,
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
    <button type="button" class="touchBtn touchDir" data-hold="left" aria-label="Walk left">${ICON.left}</button>
    <div class="touchRight">
      <button type="button" class="touchBtn touchUse" data-action="interact" aria-label="Use">${ICON.use}<span>USE</span></button>
      <button type="button" class="touchBtn touchStamp" data-action="attack" aria-label="Action">${ICON.act}<span>ACT</span></button>
      <button type="button" class="touchBtn touchDir" data-hold="right" aria-label="Walk right">${ICON.right}</button>
    </div>
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
  window
    .matchMedia("(orientation: portrait)")
    .addEventListener("change", syncLayout);
  new ResizeObserver(syncLayout).observe(pad);
}
