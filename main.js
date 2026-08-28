import { level, floorById } from "./levelData.js";
import { loadAllAssets } from "./assets.js";
import { buildEntities } from "./entities.js";
import { takeAction, clearActions } from "./input.js";
import { aabbOverlap } from "./physics.js";
import { getOverlappingDoor, tickDoorCooldown, tryEnterDoor } from "./rooms.js";
import { makeCamera, render, syncCanvasSize, updateCamera } from "./render.js";
import {
  mountTouchControls,
  setInteractReady,
  usingTouchControls,
} from "./controller.js";
import { startBackgroundMusic } from "./audio.js";
import { createCoreLoadingGate } from "./loadingGate.js";
import { createIntro } from "./intro.js";
import { mountAudioHud } from "./audioHud.js";

const canvas = document.getElementById("game"),
  ctx = canvas.getContext("2d");
const hearts = document.getElementById("hearts"),
  objective = document.getElementById("objective");
const toastElement = document.getElementById("toast");
let player,
  enemies,
  collectibles,
  camera,
  intro,
  lastTime = 0,
  time = 0,
  currentFloor = 1,
  toastTime = 0;

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
  const require = floorDef(floor)?.require;
  if (!require) return true;
  const enemiesMap = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const items = new Map(collectibles.map((item) => [item.id, item]));
  for (const id of require.defeat || []) {
    if (!enemiesMap.get(id)?.dead) return false;
  }
  for (const id of require.collect || []) {
    if (!items.get(id)?.collected) return false;
  }
  return true;
}
function retryFloor() {
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
function handleInteraction() {
  if (!takeAction("interact") || player.dead) return;
  if (level.goal && currentFloor === level.goal.floor && aabbOverlap(player, level.goal)) {
    player.interact();
    toast(level.goal.completionText || "Complete.");
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
  enemies.forEach((enemy) => enemy.update(dt));
  collectibles.forEach((item) => {
    if (item.collected) item.collectAge += dt;
  });
  intro.update(dt);
  if (!intro.playing) intro = null;
}
function update(dt) {
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
  enemies.forEach((enemy) => enemy.update(dt));
  collectibles.forEach((item) => {
    if (item.collected) item.collectAge += dt;
  });
  collectItems();
  handleInteraction();
}
function updateHud() {
  if (hearts)
    hearts.textContent =
      "♥".repeat(Math.max(0, player.hp)) +
      "♡".repeat(Math.max(0, 3 - player.hp));
  if (objective) objective.textContent = objectiveText();
  setInteractReady(!!promptText());
}
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30) || 0;
  lastTime = now;
  if (intro?.playing) updateIntro(dt);
  else update(dt);
  updateCamera(camera, player, dt);
  render(ctx, camera, player, enemies, collectibles, {
    time,
    prompt: intro?.playing ? "" : promptText(),
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
    if (level.audio?.music) startBackgroundMusic(level.audio.music);
  });

  if (objective) objective.textContent = "Loading…";
  await loadAllAssets((done, total) => {
    if (objective) objective.textContent = `Loading… ${done}/${total}`;
  });
  ({ player, enemies, collectibles } = buildEntities());
  currentFloor = player.currentFloor || 1;
  camera = makeCamera(canvas);
  syncCanvasSize(canvas);
  window.addEventListener("resize", () => syncCanvasSize(canvas));
  mountTouchControls();
  mountAudioHud();

  await gate.waitForCompletion();
  gate.teardown();
  document.body.classList.add("is-playing");
  if (level.introShots?.length) intro = createIntro(camera, player);
  requestAnimationFrame(loop);
}
init().catch((error) => {
  document.body.classList.add("is-playing");
  if (objective) objective.textContent = error.message;
  console.error(error);
});
