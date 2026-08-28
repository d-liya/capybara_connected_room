export const keys = { left: false, right: false };
const pressed = new Set();
const held = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};
const actions = {
  Space: "attack",
  KeyJ: "attack",
  KeyX: "attack",
  ArrowUp: "interact",
  KeyW: "interact",
  KeyE: "interact",
  KeyR: "reset",
};

window.addEventListener("keydown", (event) => {
  const hold = held[event.code],
    action = actions[event.code];
  if (hold) keys[hold] = true;
  if (action && !event.repeat) pressed.add(action);
  if (hold || action) event.preventDefault();
});
window.addEventListener("keyup", (event) => {
  if (held[event.code]) keys[held[event.code]] = false;
});
window.addEventListener("blur", () => {
  keys.left = keys.right = false;
  pressed.clear();
});

export function pressAction(name) {
  pressed.add(name);
}
export function takeAction(name) {
  if (!pressed.has(name)) return false;
  pressed.delete(name);
  return true;
}
export function clearActions() {
  pressed.clear();
}

export const debugState = { showBBoxes: false };
window.addEventListener("keydown", (event) => {
  if (event.code !== "Backquote") return;
  debugState.showBBoxes = !debugState.showBBoxes;
  const toggle = document.getElementById("dbgToggle");
  if (toggle) toggle.checked = debugState.showBBoxes;
});
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("dbgToggle")
    ?.addEventListener(
      "change",
      (event) => (debugState.showBBoxes = event.target.checked),
    );
});
