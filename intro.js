import { level, floorById } from "./levelData.js";
import { takeAction, clearActions } from "./input.js";
import { getAudioDuration, playDialogue, stopDialogue } from "./audio.js";
import { lookAt, getFollowLook } from "./render.js";

const SKIP_GUARD_S = 0.42;
const SETTLE_S = 0.95;
const HOLD_TAIL_S = 0.45;
const CAPTION_FADE_S = 0.28;
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

function holdDuration(shot) {
  if (shot?.follow) return shot.hold || 0.1;
  if (shot?.dialogueUrl) {
    const audio = getAudioDuration(shot.dialogueUrl);
    if (audio > 0) return audio + HOLD_TAIL_S;
    return Math.max(shot.hold || 0, 4);
  }
  const text = [shot?.caption?.title, shot?.caption?.line]
    .filter(Boolean)
    .join(" ");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const read = words ? Math.min(3.6, 1.6 + words * 0.22) : 0;
  return Math.max(shot.hold || 0, read);
}

function injectStyles() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
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
      z-index: 40;
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
      touch-action: none;
      background:
        linear-gradient(to bottom, rgba(6, 4, 2, 0.42) 0%, transparent 18%, transparent 58%, rgba(6, 4, 2, 0.62) 100%);
    }
    #introOverlay.is-leaving {
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.45s ease;
    }
    #introCaption {
      position: absolute;
      left: 50%;
      bottom: max(28px, calc(18px + var(--safe-bottom)));
      transform: translateX(-50%);
      width: min(92%, 560px);
      text-align: center;
      color: #f3dfad;
      background: rgba(8, 7, 5, 0.82);
      border: 2px solid rgba(185, 162, 115, 0.88);
      box-shadow: 3px 3px 0 rgba(9, 8, 6, 0.55);
      padding: 12px 16px 14px;
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
      font: 700 24px/1.15 Georgia, serif;
      letter-spacing: 0.03em;
      text-shadow: 0 2px 8px #000;
    }
    #introCaption .line {
      display: block;
      margin-top: 8px;
      font: 600 16px/1.4 Georgia, serif;
      color: #fff6d8;
      text-shadow: 0 2px 6px #000;
    }
    #introSkip {
      position: absolute;
      right: max(14px, var(--safe-right));
      top: max(14px, var(--safe-top));
      z-index: 1;
      appearance: none;
      border: 1px solid rgba(197, 173, 116, 0.65);
      background: rgba(8, 7, 5, 0.72);
      color: #ead7a8;
      font: 600 12px/1 Georgia, serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 7px 11px;
      pointer-events: auto;
      cursor: pointer;
    }
    @media (max-width: 700px) {
      #introCaption { padding: 10px 12px 12px; }
      #introCaption .title { font-size: 18px; }
      #introCaption .kicker { font-size: 9px; }
      #introCaption .line { font-size: 14px; }
    }
  `;
}

function mountOverlay(root) {
  document.getElementById("introOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "introOverlay";
  overlay.innerHTML = `
    <div id="introCaption">
      <span class="kicker"></span>
      <span class="title"></span>
      <span class="line"></span>
    </div>
    <button type="button" id="introSkip">Skip</button>
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
  const lineEl = captionEl.querySelector(".line");
  const playedDialogue = new Set();

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

  function playShotDialogue(index) {
    const shot = shots[index];
    if (!shot?.dialogueUrl || playedDialogue.has(index)) return;
    playedDialogue.add(index);
    playDialogue(shot.dialogueUrl, {
      volume: shot.dialogueVolume ?? 1,
    });
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
    const line = caption?.line || "";
    const key = `${kicker}|${title}|${line}`;
    if (key !== shownCaption) {
      shownCaption = key;
      kickerEl.textContent = kicker;
      titleEl.textContent = title;
      lineEl.textContent = line;
      kickerEl.style.display = kicker ? "block" : "none";
      titleEl.style.display = title ? "block" : "none";
      lineEl.style.display = line ? "block" : "none";
    }
    captionEl.style.opacity = visible && (title || line) ? "1" : "0";
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
    stopDialogue();
    const follow = getFollowLook(camera, player);
    lookAt(camera, follow.x, follow.y, follow.zoom);
    camera.scripted = false;
    overlay.classList.add("is-leaving");
    document.body.classList.remove("is-intro");
    clearActions();
    window.setTimeout(() => overlay.remove(), 480);
  }

  function requestSkip(force = false) {
    if (!playing || settling) return;
    if (!force && age < SKIP_GUARD_S) return;
    settling = true;
    settleTime = 0;
    settleFrom = currentLook();
    stopDialogue();
    setCaption(null, false);
  }

  const startPose = resolve(shots[0]);
  lookAt(camera, startPose.x, startPose.y, startPose.zoom);
  setCaption(startPose.caption, true);
  playShotDialogue(0);

  overlay.querySelector("#introSkip").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    requestSkip(true);
  });
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
        takeAction("primary") ||
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
        setCaption(null, false);
        if (shot.follow) overlay.style.opacity = String(1 - t);
        if (t >= 1) {
          phase = "hold";
          phaseTime = 0;
          playShotDialogue(shotIndex);
        }
        return playing;
      }

      lookAt(camera, to.x, to.y, to.zoom);
      const hold = holdDuration(shot);
      setCaption(
        to.caption,
        !shot.follow && !(hold > 0 && phaseTime > hold - CAPTION_FADE_S),
      );
      if (phaseTime >= hold) {
        if (shotIndex >= shots.length - 1) {
          finish();
          return playing;
        }
        shotIndex += 1;
        phase = shots[shotIndex].move > 0 ? "move" : "hold";
        phaseTime = 0;
        if (phase === "hold") playShotDialogue(shotIndex);
        else stopDialogue();
      }
      return playing;
    },
  };
}
