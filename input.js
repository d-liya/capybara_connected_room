export const keys = { left: false, right: false, jump: false };
const pressed = new Set();

const held = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "jump",
};
const actions = {
  ArrowUp: "interact", KeyW: "interact", KeyE: "interact",
  KeyR: "reset",
};

window.addEventListener("keydown", (event) => {
  const heldKey = held[event.code];
  const action = actions[event.code];
  if (heldKey) keys[heldKey] = true;
  if (action && !event.repeat) pressed.add(action);
  if (heldKey || action) event.preventDefault();
});

window.addEventListener("keyup", (event) => {
  const heldKey = held[event.code];
  if (heldKey) keys[heldKey] = false;
});

export function takeAction(name) {
  if (!pressed.has(name)) return false;
  pressed.delete(name);
  return true;
}

export const debugState = { showBBoxes: false };
window.addEventListener("keydown", (event) => {
  if (event.code !== "Backquote") return;
  debugState.showBBoxes = !debugState.showBBoxes;
  const toggle = document.getElementById("dbgToggle");
  if (toggle) toggle.checked = debugState.showBBoxes;
});

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("dbgToggle");
  toggle?.addEventListener("change", () => {
    debugState.showBBoxes = toggle.checked;
  });
});
