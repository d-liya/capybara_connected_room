import { level } from "./levelData.js";
import { loadAllAssets } from "./assets.js";
import { buildEntities } from "./entities.js";
import { aabbOverlap } from "./physics.js";
import { getOverlappingDoor, tickDoorCooldown, tryEnterDoor } from "./rooms.js";
import { makeCamera, render, updateCamera } from "./render.js";

const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const hearts = document.getElementById("hearts");
const objective = document.getElementById("objective");

let player;
let enemies;
let collectibles;
let camera;
let lastTime = 0;

async function init() {
  objective.textContent = "Loading…";
  await loadAllAssets((done, total) => {
    objective.textContent = `Loading… ${done}/${total}`;
  });
  ({ player, enemies, collectibles } = buildEntities());
  camera = makeCamera(canvas);
  objective.textContent = level.objective;
  requestAnimationFrame(loop);
}

function updateGameplay(dt) {
  tickDoorCooldown(dt);
  player.update(dt);
  enemies.forEach((enemy) => enemy.update(dt));
  tryEnterDoor(player);

  for (const item of collectibles) {
    if (!item.collected && aabbOverlap(player, item)) item.collected = true;
  }
  if (level.goal && aabbOverlap(player, level.goal)) {
    objective.textContent = level.goal.completionText ?? "Complete";
  }
}

function updateHud() {
  hearts.textContent = "♥".repeat(Math.max(0, player.hp));
}

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, 1 / 30) || 0;
  lastTime = time;
  updateGameplay(dt);
  updateCamera(camera, player);
  render(context, camera, player, enemies, collectibles, {
    nearDoor: !!getOverlappingDoor(player),
  });
  updateHud();
  requestAnimationFrame(loop);
}

init().catch((error) => {
  objective.textContent = error.message;
  console.error(error);
});
