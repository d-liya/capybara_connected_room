// main.js
import { level } from "./levelData.js";
import { loadAllAssets } from "./assets.js";
import { buildEntities } from "./entities.js";
import { makeCamera, updateCamera, render } from "./render.js";
import { aabbOverlap } from "./physics.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const objectiveEl = document.getElementById("objective");
const heartsEl = document.getElementById("hearts");

let player, enemies, collectibles, camera;
let lastTime = 0;

async function init() {
  objectiveEl.textContent = "Loading assets...";

  await loadAllAssets((done, total, name) => {
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
      objectiveEl.textContent = "Star Map recovered!";
    }
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 1 / 30) || 0;
  lastTime = timestamp;

  player.update(dt);
  for (const e of enemies) e.update(dt);
  checkCollectibles();

  updateCamera(camera, player);
  render(ctx, camera, player, enemies, collectibles);
  updateHUD();

  requestAnimationFrame(loop);
}

init();
