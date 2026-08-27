import { level } from "./levelData.js";
import { images } from "./assets.js";
import { debugState } from "./input.js";

export function makeCamera(canvas) {
  return {
    x: 0,
    y: 0,
    scale: Math.min(
      canvas.width / level.background.width,
      canvas.height / level.background.height,
    ),
    canvas,
  };
}

export function updateCamera() {}

function screen(camera, x, y) {
  return { x: (x - camera.x) * camera.scale, y: (y - camera.y) * camera.scale };
}

function drawEntity(ctx, camera, entity, color, imageKey) {
  const point = screen(camera, entity.x, entity.y);
  const width = entity.w * camera.scale;
  const height = entity.h * camera.scale;
  const image = imageKey ? images[imageKey] : null;
  if (image) {
    ctx.save();
    ctx.translate(point.x + width / 2, point.y);
    ctx.scale(entity.facing ?? entity.direction ?? 1, 1);
    ctx.drawImage(image, -width / 2, 0, width, height);
    ctx.restore();
    return;
  }
  ctx.fillStyle = color;
  ctx.fillRect(point.x, point.y, width, height);
}

export function render(ctx, camera, player, enemies, collectibles, ui = {}) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17202a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (images.background) {
    ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#34495e";
    for (const platform of level.platforms) {
      const point = screen(camera, platform.x, platform.y);
      ctx.fillRect(point.x, point.y, platform.w * camera.scale, platform.h * camera.scale);
    }
  }

  for (const item of collectibles) {
    if (!item.collected) drawEntity(ctx, camera, item, "#f4d03f", item.imageKey);
  }
  for (const enemy of enemies) {
    drawEntity(ctx, camera, enemy, "#c0392b", enemy.imageKey);
  }
  drawEntity(ctx, camera, player, "#5dade2", level.player.imageKey);

  if (ui.nearDoor) {
    ctx.fillStyle = "white";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Enter", canvas.width / 2, canvas.height - 28);
  }
  if (debugState.showBBoxes) drawDebug(ctx, camera);
}

function drawDebug(ctx, camera) {
  const groups = [
    ["platforms", "lime"], ["walls", "orange"], ["hazards", "red"],
    ["doors", "cyan"], ["collectibles", "gold"],
  ];
  ctx.font = "12px monospace";
  for (const [key, color] of groups) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    for (const box of level[key]) {
      const point = screen(camera, box.x, box.y);
      ctx.strokeRect(point.x, point.y, box.w * camera.scale, box.h * camera.scale);
      ctx.fillText(box.id, point.x, point.y - 3);
    }
  }
}
