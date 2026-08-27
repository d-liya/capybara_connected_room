// render.js
import { level } from "./levelData.js";
import { images } from "./assets.js";
import { debugState } from "./input.js";

// The canvas is 1280x720; the source image may be larger (e.g. 2560x1381).
// We compute a uniform scale + camera offset so gameplay coords (native
// image space) map correctly to canvas pixels, and follow the player.
export function makeCamera(canvas) {
  return {
    x: 0, y: 0,
    scale: canvas.width / level.background.width, // fit width; adjust as needed
    canvas
  };
}

export function updateCamera(camera, player) {
  const viewW = camera.canvas.width / camera.scale;
  const viewH = camera.canvas.height / camera.scale;

  camera.x = player.x + player.w / 2 - viewW / 2;
  camera.y = player.y + player.h / 2 - viewH / 2;

  camera.x = Math.max(0, Math.min(camera.x, level.background.width - viewW));
  camera.y = Math.max(0, Math.min(camera.y, level.background.height - viewH));
}

function worldToScreen(camera, x, y) {
  return {
    sx: (x - camera.x) * camera.scale,
    sy: (y - camera.y) * camera.scale
  };
}

export function render(ctx, camera, player, enemies, collectibles, ui = {}) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  const bg = images.background;
  if (bg) {
    const { sx, sy } = worldToScreen(camera, 0, 0);
    ctx.drawImage(
      bg,
      0, 0, level.background.width, level.background.height,
      sx, sy, level.background.width * camera.scale, level.background.height * camera.scale
    );
  }

  // collectibles
  for (const c of collectibles) {
    if (c.collected) continue;
    const { sx, sy } = worldToScreen(camera, c.x, c.y);
    ctx.save();
    ctx.shadowColor = "rgba(255,240,180,0.9)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(255,240,180,0.15)";
    ctx.fillRect(sx, sy, c.w * camera.scale, c.h * camera.scale);
    ctx.restore();
  }

  // enemies
  for (const e of enemies) {
    const { sx, sy } = worldToScreen(camera, e.x, e.y);
    e.anim.draw(ctx, sx, sy, e.w * camera.scale, e.h * camera.scale);
  }

  // player
  {
    const { sx, sy } = worldToScreen(camera, player.x, player.y);
    if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    player.anim.draw(ctx, sx, sy, player.w * camera.scale, player.h * camera.scale);
    ctx.globalAlpha = 1;
  }

  if (ui.nearDoorHint) {
    ctx.save();
    ctx.font = "20px Georgia, serif";
    ctx.fillStyle = "#fff8e0";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText("Enter \u2191", canvas.width / 2, canvas.height - 36);
    ctx.restore();
  }

  if (debugState.showBBoxes) drawDebugOverlay(ctx, camera);
}

function drawDebugOverlay(ctx, camera) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.font = "12px monospace";

  const groups = [
    ["platforms", "lime"],
    ["hazards", "red"],
    ["doors", "cyan"],
    ["collectibles", "gold"]
  ];

  for (const [key, color] of groups) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    for (const box of level[key]) {
      const { sx, sy } = worldToScreen(camera, box.x, box.y);
      const w = box.w * camera.scale, h = box.h * camera.scale;
      ctx.strokeRect(sx, sy, w, h);
      ctx.fillText(box.id, sx + 2, sy - 4);
    }
  }
  ctx.restore();
}
