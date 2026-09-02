import { level, floorById } from "./levelData.js";
import { loadAllAssets } from "./assets.js";
import { buildEntities } from "./entities.js";
import { takeAction, clearActions, keys } from "./input.js";
import { aabbOverlap } from "./physics.js";
import { getOverlappingDoor, tickDoorCooldown, tryEnterDoor } from "./rooms.js";
import {
  makeCamera,
  render,
  syncCanvasSize,
  updateCamera,
  warmImageAnchors,
} from "./render.js";
import {
  mountTouchControls,
  setInteractReady,
  setPrimaryActionPresentation,
  usingTouchControls,
} from "./controller.js";
import {
  preloadAudio,
  setAudioOutputSuspended,
  startBackgroundMusic,
  unlockAudio,
} from "./audio.js";
import { createCoreLoadingGate } from "./loadingGate.js";
import { createIntro } from "./intro.js";
import { createCompletion } from "./completion.js";
import { mountAudioHud } from "./audioHud.js";
import { createMechanics } from "./mechanics.js";

const canvas = document.getElementById("game"),
  ctx = canvas.getContext("2d", { alpha: false });
const hearts = document.getElementById("hearts"),
  objective = document.getElementById("objective");
const toastElement = document.getElementById("toast");
let player,
  actors,
  collectibles,
  mechanics,
  camera,
  intro,
  completion,
  lastTime = 0,
  paused = false,
  pauseOverlay = null,
  pauseHud = null,
  time = 0,
  currentFloor = 1,
  toastTime = 0,
  lastHearts = "",
  lastObjective = "",
  lastInteractReady = null;

function toast(text, duration = 1.8) {
  if (!toastElement) return;
  toastElement.textContent = text;
  toastElement.classList.add("show");
  toastTime = duration;
}
function floorDef(floor = currentFloor) {
  return floorById.get(floor);
}
function floorReady(floor) {
  return mechanics.requirementsMet(floorDef(floor)?.require);
}
function retryFloor() {
  mechanics.resetFloor(currentFloor);
  actors.forEach((actor) => {
    if (actor.floor === currentFloor) actor.reset();
  });
  player.retry();
  clearActions();
  toast("Floor restarted.");
}
function collectItems() {
  for (const item of collectibles) {
    if (
      item.floor !== currentFloor ||
      item.collected ||
      !aabbOverlap(player, item)
    )
      continue;
    item.collected = true;
    item.collectAge = 0;
    toast("Picked up.");
  }
}
function interactionBody(interaction) {
  if (
    Number.isFinite(interaction.x) &&
    Number.isFinite(interaction.y) &&
    Number.isFinite(interaction.w) &&
    Number.isFinite(interaction.h)
  ) {
    return interaction;
  }
  return (
    level.instances?.find(
      (item) =>
        item.id === interaction.sourceId ||
        item.canonicalId === interaction.sourceId,
    ) || null
  );
}
function availableInteraction() {
  return (level.interactions || []).find((interaction) => {
    if (
      interaction.trigger !== "interact" ||
      interaction.floor !== currentFloor
    ) {
      return false;
    }
    const body = interactionBody(interaction);
    return body && aabbOverlap(player, body);
  });
}
function handleInteraction() {
  if (!takeAction("interact") || player.dead) return;
  if (level.goal && currentFloor === level.goal.floor && aabbOverlap(player, level.goal)) {
    player.interact();
    const completionText = level.goal.completionText || "Adventure complete!";
    toast(completionText);
    completion = createCompletion(camera, player, level.goal, {
      title: completionText,
    });
    return;
  }
  const interaction = availableInteraction();
  if (interaction) {
    if (!mechanics.requirementsMet(interaction.conditions)) {
      toast(interaction.blockedFeedback || "Something is still missing.");
      return;
    }
    player.interact();
    mechanics.applyEffects(interaction.effects);
    mechanics.set(interaction.id, true);
    toast(interaction.feedback?.[0] || "Done.");
    return;
  }
  const door = getOverlappingDoor(player, currentFloor);
  if (door) {
    player.interact();
    const allowed = !door.forward || floorReady(currentFloor);
    const result = tryEnterDoor(player, currentFloor, allowed);
    if (!result.ok) {
      if (!result.silent) toast(result.reason);
      return;
    }
    currentFloor = result.toFloor;
    toast(`Floor ${currentFloor}: ${floorDef(currentFloor).name}`);
    return;
  }
  const inspect = floorDef()?.inspect;
  if (inspect && player.x > inspect.minX) {
    player.interact();
    toast(inspect.toast);
    return;
  }
  player.interact();
}
function objectiveText() {
  const parts = floorDef()?.objective;
  if (typeof parts === "string") return parts;
  return level.objective;
}
function promptText() {
  const verb = usingTouchControls() ? "USE" : "E";
  if (
    level.goal &&
    currentFloor === level.goal.floor &&
    aabbOverlap(player, level.goal)
  )
    return `${verb} — ${level.goal.prompt || "Use"}`;
  const interaction = availableInteraction();
  if (interaction) return `${verb} — ${interaction.prompt || "Use"}`;
  const door = getOverlappingDoor(player, currentFloor);
  if (door) return `${verb} — Use door`;
  const inspect = floorDef()?.inspect;
  if (inspect && player.x > inspect.minX)
    return `${verb} — ${inspect.prompt}`;
  return "";
}
function updateIntro(dt) {
  time += dt;
  player.update(dt, true);
  actors.forEach((actor) => actor.update(dt, currentFloor));
  collectibles.forEach((item) => {
    if (item.collected) item.collectAge += dt;
  });
  intro.update(dt);
  if (!intro.playing) intro = null;
}
function update(dt) {
  if (completion) {
    time += dt;
    completion.update(dt);
    return;
  }
  time += dt;
  tickDoorCooldown(dt);
  if (toastTime > 0) {
    toastTime -= dt;
    if (toastTime <= 0) toastElement?.classList.remove("show");
  }
  if (takeAction("reset")) {
    retryFloor();
    return;
  }
  player.update(dt, false);
  actors.forEach((actor) => actor.update(dt, currentFloor));
  collectibles.forEach((item) => {
    if (item.collected) item.collectAge += dt;
  });
  collectItems();
  handleInteraction();
}
function updateHud() {
  if (hearts) {
    const hasHealth =
      Number.isFinite(player.hp) && Number.isFinite(player.maxHp);
    const next = hasHealth
      ? "♥".repeat(Math.max(0, player.hp)) +
        "♡".repeat(Math.max(0, player.maxHp - player.hp))
      : "";
    hearts.hidden = !hasHealth;
    if (next !== lastHearts) {
      hearts.textContent = next;
      lastHearts = next;
    }
  }
  if (objective) {
    const next = objectiveText();
    if (next !== lastObjective) {
      objective.textContent = next;
      lastObjective = next;
    }
  }
  const ready = !!promptText();
  if (ready !== lastInteractReady) {
    setInteractReady(ready);
    lastInteractReady = ready;
  }
}
function ensurePauseOverlay() {
  if (pauseOverlay) return pauseOverlay;
  pauseOverlay = document.createElement("div");
  pauseOverlay.id = "pauseOverlay";
  pauseOverlay.hidden = true;
  pauseOverlay.innerHTML = `
    <div class="pauseDialog" role="dialog" aria-labelledby="pauseDialogTitle" aria-describedby="pauseDialogHint">
      <strong id="pauseDialogTitle">Paused</strong>
      <span id="pauseDialogHint">Take a breather. Your progress is right here.</span>
      <button type="button" id="pauseResumeButton">Resume game</button>
    </div>`;
  pauseOverlay
    .querySelector("#pauseResumeButton")
    ?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setPaused(false);
    });
  document.getElementById("stage")?.appendChild(pauseOverlay);
  return pauseOverlay;
}

function setPaused(next) {
  next = !!next;
  if (paused === next) return;
  paused = next;
  document.body.classList.toggle("is-paused", paused);
  pauseHud?.setPaused(paused);
  keys.left = keys.right = false;
  clearActions();
  setAudioOutputSuspended(paused);
  const overlay = ensurePauseOverlay();
  overlay.hidden = !paused;
  if (!paused) {
    lastTime = 0;
    unlockAudio();
  }
}

function bindPagePause() {
  const sync = () => setPaused(document.hidden);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => setPaused(true));
  window.addEventListener("pageshow", () => {
    if (!document.hidden) setPaused(false);
  });
}

function loop(now) {
  if (paused) {
    lastTime = now;
    requestAnimationFrame(loop);
    return;
  }
  if (!lastTime) lastTime = now;
  const dt = Math.min((now - lastTime) / 1000, 1 / 30) || 0;
  lastTime = now;
  if (intro?.playing) updateIntro(dt);
  else update(dt);
  if (!completion) updateCamera(camera, player, dt);
  render(ctx, camera, player, actors, collectibles, {
    time,
    prompt: intro?.playing || completion ? "" : promptText(),
  });
  if (!intro?.playing) updateHud();
  requestAnimationFrame(loop);
}
async function init() {
  window.game_title = level.title || level.name;
  const gate = createCoreLoadingGate(canvas, {
    dataFiles: level.background?.url
      ? [{ url: level.background.url, name: level.name }]
      : [],
  });
  gate.onContinue(() => {
    unlockAudio();
    if (level.audio?.music) startBackgroundMusic(level.audio.music);
  });

  if (objective) objective.textContent = "Loading…";
  const audioReady = preloadAudio([
    ...(level.audio?.sfx || []).map((clip) => clip.url),
    ...(level.audio?.dialogue || []).map((clip) => clip.url),
    ...(level.introShots || []).map((shot) => shot.dialogueUrl).filter(Boolean),
  ]);
  await loadAllAssets((done, total) => {
    if (objective) objective.textContent = `Loading… ${done}/${total}`;
  });
  warmImageAnchors();
  await audioReady;

  ({ player, actors, collectibles } = buildEntities());
  mechanics = createMechanics(level, { actors, collectibles });
  currentFloor = player.currentFloor || 1;
  camera = makeCamera(canvas);
  syncCanvasSize(canvas);
  window.addEventListener("resize", () => syncCanvasSize(canvas));
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => syncCanvasSize(canvas)).observe(canvas);
  }
  await gate.waitForCompletion();
  gate.teardown();
  document.body.classList.add("is-playing");
  mountTouchControls();
  setPrimaryActionPresentation(level.controls?.primary);
  pauseHud = mountAudioHud(document.getElementById("stage"), {
    onPausedChange: setPaused,
  });
  bindPagePause();
  if (level.introShots?.length) intro = createIntro(camera, player);
  requestAnimationFrame(loop);
}
init().catch((error) => {
  document.body.classList.add("is-playing");
  if (objective) objective.textContent = error.message;
  console.error(error);
});
