// main.js
import { level } from "./levelData.js";
import { loadAllAssets } from "./assets.js";
import { buildEntities } from "./entities.js";
import { makeCamera, updateCamera, render } from "./render.js";
import { aabbOverlap } from "./physics.js";
import { tryEnterDoor, tickDoorCooldown, getOverlappingDoor } from "./rooms.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const objectiveEl = document.getElementById("objective");
const heartsEl = document.getElementById("hearts");

let player, enemies, collectibles, camera;
let lastTime = 0;
let nearDoorHint = false;

// ---- Extension hooks (wire gameplay / cutscenes / room swaps here) ----

function onCollect(collectible, _player) {
  // e.g. inventory push, quest flags, SFX
  if (collectible.type === "starmap") {
    objectiveEl.textContent = "Star Map recovered!";
  } else {
    objectiveEl.textContent = `Collected: ${collectible.id}`;
  }
}

function onDoorEnter(fromDoor, toDoor, _player) {
  // e.g. fade, swap room data, play door SFX
  // Currently same-background teleport only.
  void fromDoor;
  void toDoor;
}

// ---- Game setup ----

async function init() {
  objectiveEl.textContent = "Loading assets...";

  await loadAllAssets((done, total) => {
    objectiveEl.textContent = `Loading assets... (${done}/${total})`;
  });

  objectiveEl.textContent = level.objective;

  const built = buildEntities();
  player = built.player;
  enemies = built.enemies;
  collectibles = built.collectibles;

  camera = makeCamera(canvas);

  requestAnimationFrame(loop);
}

function updateHUD() {
  heartsEl.textContent = "\u2764\uFE0F".repeat(Math.max(player.hp, 0));
}

function checkCollectibles() {
  for (const c of collectibles) {
    if (!c.collected && aabbOverlap(player, c)) {
      c.collected = true;
      onCollect(c, player);
    }
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 1 / 30) || 0;
  lastTime = timestamp;

  tickDoorCooldown(dt);
  player.update(dt);

  const entered = tryEnterDoor(player);
  if (entered) onDoorEnter(entered.from, entered.to, player);

  nearDoorHint = !!getOverlappingDoor(player);

  for (const e of enemies) e.update(dt);
  checkCollectibles();

  updateCamera(camera, player);
  render(ctx, camera, player, enemies, collectibles, { nearDoorHint });
  updateHUD();

  requestAnimationFrame(loop);
}

init();
