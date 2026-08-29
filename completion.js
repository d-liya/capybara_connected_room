import { lookAt } from "./render.js";

const STYLE_ID = "completion-style";

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #completionOverlay {
      position: absolute;
      inset: 0;
      z-index: 45;
      display: grid;
      place-items: center;
      background: linear-gradient(transparent 40%, rgba(8, 7, 5, 0.76));
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s ease;
    }
    #completionOverlay.is-visible {
      opacity: 1;
      pointer-events: auto;
    }
    #completionCard {
      align-self: end;
      margin-bottom: max(28px, calc(18px + var(--safe-bottom)));
      padding: 14px 18px;
      color: #fff7dc;
      text-align: center;
      background: rgba(14, 11, 7, 0.88);
      border: 2px solid #c9ad70;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
    }
    #completionCard strong { display: block; font: 700 22px/1.2 system-ui; }
    #completionReplay {
      margin-top: 10px;
      padding: 8px 14px;
      border: 1px solid #ead79d;
      color: #1b1409;
      background: #f4d67d;
      font: 700 14px/1 system-ui;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

export function createCompletion(
  camera,
  player,
  target,
  { title = "Adventure complete!", zoom = 2.7, onReplay } = {},
) {
  injectStyles();
  document.getElementById("completionOverlay")?.remove();

  const root = document.getElementById("stage");
  const overlay = document.createElement("div");
  overlay.id = "completionOverlay";
  overlay.innerHTML = `
    <div id="completionCard">
      <strong></strong>
      <button type="button" id="completionReplay">Play again</button>
    </div>
  `;
  overlay.querySelector("strong").textContent = title;
  root?.appendChild(overlay);

  const from = {
    x: camera.x + camera.viewW / 2,
    y: camera.y + camera.viewH / 2,
    zoom: camera.zoom || 1,
  };
  const focus = target || player;
  const to = {
    x: focus.x + focus.w / 2,
    y: focus.y + focus.h * 0.45,
    zoom,
  };
  let age = 0;
  const moveDuration = 0.85;
  camera.scripted = true;

  overlay.querySelector("#completionReplay").addEventListener("click", () => {
    if (onReplay) onReplay();
    else window.location.reload();
  });

  return {
    get playing() {
      return true;
    },
    update(dt) {
      age += dt;
      const t = easeOutCubic(Math.min(1, age / moveDuration));
      lookAt(
        camera,
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t,
        from.zoom + (to.zoom - from.zoom) * t,
      );
      if (age >= moveDuration + 0.25) overlay.classList.add("is-visible");
    },
    destroy() {
      overlay.remove();
      camera.scripted = false;
    },
  };
}
