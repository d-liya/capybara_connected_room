import { level, floorById } from "./levelData.js";
import { takeAction, clearActions } from "./input.js";
import { lookAt, getFollowLook } from "./render.js";

const SKIP_GUARD_S = 0.42;
const SETTLE_S = 0.48;
const STYLE_ID = "intro-cinematic-style";
const FLOOR_LOOK_ABOVE = 100;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

const EASE = {
  inOutCubic: easeInOutCubic,
  outCubic: easeOutCubic,
};

function easeOf(shot) {
  if (typeof shot?.ease === "function") return shot.ease;
  return EASE[shot?.ease] || easeInOutCubic;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function resolveShot(shot, camera, player) {
  if (shot.follow) {
    return { ...getFollowLook(camera, player), caption: shot.caption };
  }
  if (shot.player) {
    const floor = floorById.get(player.currentFloor ?? player.floor);
    return {
      x: player.x + player.w / 2,
      y: player.y + player.h * 0.42,
      zoom: shot.zoom,
      caption: shot.caption ?? {
        kicker: `Floor ${floor.floor}`,
        title: floor.name,
      },
    };
  }
  if (shot.goal) {
    const goal = level.goal;
    return {
      x: goal.x + goal.w / 2,
      y: goal.y + goal.h * 0.42,
      zoom: shot.zoom,
      caption: shot.caption,
    };
  }
  if (shot.floor) {
    const floor = floorById.get(shot.floor);
    return {
      x: shot.x,
      y: shot.y ?? floor.groundY - FLOOR_LOOK_ABOVE,
      zoom: shot.zoom,
      caption: shot.caption ?? {
        kicker: `Floor ${shot.floor}`,
        title: floor.name,
      },
    };
  }
  return shot;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    body.is-intro #hud,
    body.is-intro #controls,
    body.is-intro #toast,
    body.is-intro #touchPad,
    body.is-intro #debugPanel {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    #introOverlay {
      position: absolute;
      inset: 0;
      z-index: 12;
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
      touch-action: none;
      background:
        radial-gradient(ellipse at center, transparent 46%, rgba(6, 4, 2, 0.55) 100%);
    }
    #introOverlay.is-leaving {
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.45s ease;
    }
    #introCaption {
      position: absolute;
      left: 50%;
      bottom: max(52px, calc(28px + var(--safe-bottom)));
      transform: translateX(-50%);
      width: min(92%, 520px);
      text-align: center;
      color: #f3dfad;
      text-shadow: 0 2px 8px #000, 0 0 18px rgba(0, 0, 0, 0.8);
      opacity: 0;
      transition: opacity 0.28s ease;
      pointer-events: none;
    }
    #introCaption .kicker {
      display: block;
      font: 600 11px/1.2 Georgia, serif;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: #c5ad74;
      margin-bottom: 6px;
    }
    #introCaption .title {
      display: block;
      font: 700 26px/1.15 Georgia, serif;
      letter-spacing: 0.04em;
    }
    #introSkip {
      position: absolute;
      right: max(14px, var(--safe-right));
      top: max(14px, var(--safe-top));
      border: 1px solid rgba(197, 173, 116, 0.65);
      background: rgba(8, 7, 5, 0.72);
      color: #ead7a8;
      font: 600 12px/1 Georgia, serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 7px 11px;
      pointer-events: none;
    }
    @media (max-width: 700px) {
      #introCaption .title { font-size: 18px; }
      #introCaption .kicker { font-size: 9px; }
    }
  `;
  document.head.appendChild(style);
}

function mountOverlay(root) {
  const overlay = document.createElement("div");
  overlay.id = "introOverlay";
  overlay.innerHTML = `
    <div id="introCaption">
      <span class="kicker"></span>
      <span class="title"></span>
    </div>
    <div id="introSkip">Skip</div>
  `;
  root.appendChild(overlay);
  return overlay;
}

export function createIntro(
  camera,
  player,
  { shots = level.introShots, root = document.getElementById("stage") } = {},
) {
  injectStyles();
  const overlay = mountOverlay(root);
  const captionEl = overlay.querySelector("#introCaption");
  const kickerEl = captionEl.querySelector(".kicker");
  const titleEl = captionEl.querySelector(".title");

  let playing = true;
  let shotIndex = 0;
  let phase = "hold";
  let phaseTime = 0;
  let age = 0;
  let settling = false;
  let settleTime = 0;
  let settleFrom = null;
  let shownCaption = "";

  camera.scripted = true;
  document.body.classList.add("is-intro");

  function resolve(shot) {
    return resolveShot(shot, camera, player);
  }

  function applyLook(from, to, t, ease = easeInOutCubic) {
    const u = ease(Math.max(0, Math.min(1, t)));
    lookAt(
      camera,
      lerp(from.x, to.x, u),
      lerp(from.y, to.y, u),
      lerp(from.zoom, to.zoom, u),
    );
  }

  function setCaption(caption, visible) {
    const kicker = caption?.kicker || "";
    const title = caption?.title || "";
    const key = `${kicker}|${title}`;
    if (key !== shownCaption) {
      shownCaption = key;
      kickerEl.textContent = kicker;
      titleEl.textContent = title;
    }
    captionEl.style.opacity = visible && title ? "1" : "0";
  }

  function currentLook() {
    return {
      x: camera.x + camera.viewW / 2,
      y: camera.y + camera.viewH / 2,
      zoom: camera.zoom || 1,
    };
  }

  function finish() {
    if (!playing) return;
    playing = false;
    const follow = getFollowLook(camera, player);
    lookAt(camera, follow.x, follow.y, follow.zoom);
    camera.scripted = false;
    overlay.classList.add("is-leaving");
    document.body.classList.remove("is-intro");
    clearActions();
    window.setTimeout(() => overlay.remove(), 480);
  }

  function requestSkip() {
    if (!playing || age < SKIP_GUARD_S || settling) return;
    settling = true;
    settleTime = 0;
    settleFrom = currentLook();
    setCaption(null, false);
  }

  const startPose = resolve(shots[0]);
  lookAt(camera, startPose.x, startPose.y, startPose.zoom);
  setCaption(startPose.caption, true);

  overlay.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    requestSkip();
  });

  return {
    get playing() {
      return playing;
    },
    update(dt) {
      if (!playing) return false;
      age += dt;

      if (
        takeAction("interact") ||
        takeAction("attack") ||
        takeAction("reset")
      ) {
        requestSkip();
      }

      if (settling) {
        settleTime += dt;
        const t = Math.min(1, settleTime / SETTLE_S);
        applyLook(settleFrom, getFollowLook(camera, player), t, easeOutCubic);
        overlay.style.opacity = String(1 - t);
        if (t >= 1) finish();
        return playing;
      }

      const shot = shots[shotIndex];
      const to = resolve(shot);
      phaseTime += dt;

      if (phase === "move") {
        const duration = Math.max(shot.move, 0.001);
        const t = Math.min(1, phaseTime / duration);
        applyLook(resolve(shots[shotIndex - 1]), to, t, easeOf(shot));
        setCaption(to.caption, t > 0.18 && !shot.follow);
        if (shot.follow) overlay.style.opacity = String(1 - t);
        if (t >= 1) {
          phase = "hold";
          phaseTime = 0;
        }
        return playing;
      }

      lookAt(camera, to.x, to.y, to.zoom);
      setCaption(to.caption, !(shot.hold > 0 && phaseTime > shot.hold - 0.18));
      if (phaseTime >= shot.hold) {
        if (shotIndex >= shots.length - 1) {
          finish();
          return playing;
        }
        shotIndex += 1;
        phase = shots[shotIndex].move > 0 ? "move" : "hold";
        phaseTime = 0;
      }
      return playing;
    },
  };
}
