// input.js
export const keys = {
  left: false,
  right: false,
  jump: false,
  cast: false
};

const map = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "jump", ArrowUp: "jump", KeyW: "jump",
  KeyX: "cast", KeyJ: "cast"
};

window.addEventListener("keydown", (e) => {
  const k = map[e.code];
  if (k) { keys[k] = true; e.preventDefault(); }
});

window.addEventListener("keyup", (e) => {
  const k = map[e.code];
  if (k) { keys[k] = false; e.preventDefault(); }
});

// Debug overlay toggle (` key)
export const debugState = { showBBoxes: false };
window.addEventListener("keydown", (e) => {
  if (e.code === "Backquote") {
    debugState.showBBoxes = !debugState.showBBoxes;
    const cb = document.getElementById("dbgToggle");
    if (cb) cb.checked = debugState.showBBoxes;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const cb = document.getElementById("dbgToggle");
  if (cb) cb.addEventListener("change", () => { debugState.showBBoxes = cb.checked; });
});
