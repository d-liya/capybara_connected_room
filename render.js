import { level, assetById } from "./levelData.js";
import { images } from "./assets.js";
import { debugState } from "./input.js";
import { attackBox, clamp, feetPoint } from "./physics.js";

const WORLD_W = level.bounds.width;
const WORLD_H = level.bounds.height;
const DESIGN_W = level.bounds.width;
const DESIGN_H = (level.bounds.width * 9) / 16;
const RENDER_SCALE = 2;

export function makeCamera(canvas) {
  return {
    canvas,
    x: 0,
    y: 0,
    viewW: WORLD_W,
    viewH: WORLD_H,
    zoom: 1,
    scripted: false,
    ready: false,
  };
}

export function syncCanvasSize(canvas) {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const bufferW = Math.round(width * RENDER_SCALE);
  const bufferH = Math.round(height * RENDER_SCALE);
  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW;
    canvas.height = bufferH;
  }
}

function chooseView(canvas) {
  const cssW = Math.max(1, canvas.clientWidth);
  const cssH = Math.max(1, canvas.clientHeight);
  return {
    viewW: Math.min(WORLD_W, cssW * (WORLD_W / DESIGN_W)),
    viewH: Math.min(WORLD_H, cssH * (WORLD_H / DESIGN_H)),
  };
}

function paddingWorld(camera) {
  const { canvas, viewW, viewH } = camera;
  const cssW = Math.max(1, canvas.clientWidth);
  const cssH = Math.max(1, canvas.clientHeight);
  const hud = document.getElementById("hud");
  const hudBottom = hud?.getBoundingClientRect().bottom ?? 88;
  const styles = getComputedStyle(document.documentElement);
  const safeBottom = parseFloat(styles.getPropertyValue("--safe-bottom")) || 0;
  const overlay = document.body.classList.contains("touch-overlay");
  const padH =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--touch-pad-height",
      ),
    ) || 0;
  const topCss = hudBottom + 20;
  const bottomCss = overlay ? padH + 10 : 56 + safeBottom;
  const xCss = Math.min(48, cssW * 0.1);
  return {
    top: (topCss / cssH) * viewH,
    bottom: (bottomCss / cssH) * viewH,
    x: (xCss / cssW) * viewW,
  };
}

function followTarget(camera, player) {
  const { viewW, viewH } = camera;
  const pad = paddingWorld(camera);
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;

  let targetX;
  if (viewW >= WORLD_W) targetX = (WORLD_W - viewW) / 2;
  else {
    targetX = px - viewW / 2;
    targetX = clamp(targetX, px - (viewW - pad.x), px - pad.x);
    targetX = clamp(targetX, 0, WORLD_W - viewW);
  }

  let targetY;
  if (viewH >= WORLD_H) targetY = (WORLD_H - viewH) / 2;
  else {
    targetY = py - viewH / 2;
    targetY = clamp(
      targetY,
      py + player.h / 2 - (viewH - pad.bottom),
      py - player.h / 2 - pad.top,
    );
    targetY = clamp(targetY, 0, WORLD_H - viewH);
  }
  return { x: targetX, y: targetY };
}

function applyZoomView(camera, zoom, keepCenter) {
  const cx = camera.x + camera.viewW / 2;
  const cy = camera.y + camera.viewH / 2;
  const view = chooseView(camera.canvas);
  camera.zoom = zoom;
  camera.viewW = view.viewW / zoom;
  camera.viewH = view.viewH / zoom;
  if (keepCenter) {
    camera.x = cx - camera.viewW / 2;
    camera.y = cy - camera.viewH / 2;
    clampCamera(camera);
  }
}

function clampCamera(camera) {
  camera.x = clamp(camera.x, 0, Math.max(0, WORLD_W - camera.viewW));
  camera.y = clamp(camera.y, 0, Math.max(0, WORLD_H - camera.viewH));
}

export function lookAt(camera, x, y, zoom = 1) {
  syncCanvasSize(camera.canvas);
  applyZoomView(camera, zoom, false);
  camera.x = x - camera.viewW / 2;
  camera.y = y - camera.viewH / 2;
  clampCamera(camera);
  camera.ready = true;
}

export function getFollowLook(camera, player) {
  const view = chooseView(camera.canvas);
  const probe = {
    canvas: camera.canvas,
    x: camera.x,
    y: camera.y,
    viewW: view.viewW,
    viewH: view.viewH,
    zoom: 1,
    ready: true,
  };
  const pose = followTarget(probe, player);
  return {
    x: pose.x + probe.viewW / 2,
    y: pose.y + probe.viewH / 2,
    zoom: 1,
  };
}

export function updateCamera(camera, player, dt = 0) {
  syncCanvasSize(camera.canvas);
  if (camera.scripted) {
    applyZoomView(camera, camera.zoom || 1, true);
    return;
  }
  applyZoomView(camera, 1, false);
  const target = followTarget(camera, player);
  if (!camera.ready) {
    camera.x = target.x;
    camera.y = target.y;
    camera.ready = true;
    return;
  }
  const t = 1 - Math.exp(-10 * Math.max(dt, 0));
  camera.x += (target.x - camera.x) * t;
  camera.y += (target.y - camera.y) * t;
}

function scaleX(camera) {
  return camera.canvas.width / camera.viewW;
}
function scaleY(camera) {
  return camera.canvas.height / camera.viewH;
}
const sx = (camera, x) => (x - camera.x) * scaleX(camera);
const sy = (camera, y) => (y - camera.y) * scaleY(camera);
const sw = (camera, w) => w * scaleX(camera);
const sh = (camera, h) => h * scaleY(camera);
function point(camera, x, y) {
  return { x: sx(camera, x), y: sy(camera, y) };
}
function uiPx(camera, size) {
  return size * (camera.canvas.width / Math.max(1, canvasClientWidth(camera)));
}
function canvasClientWidth(camera) {
  return camera.canvas.clientWidth;
}

function clipFor(asset, state) {
  return (
    asset.clips.find((clip) => clip.state === state) ||
    asset.clips.find((clip) => clip.state === "idle")
  );
}
function frameIndex(clip, time) {
  const count = clip.frameCount || clip.frames?.length || 1;
  const raw = Math.floor(time * clip.fps);
  return clip.loop ? raw % count : Math.min(count - 1, raw);
}
function idleSheetClip(asset) {
  if (!asset.videoBase) return null;
  return (
    asset.clips.find(
      (clip) => clip.type === "sprite-sheet" && clip.state === "idle",
    ) ?? null
  );
}
function sheetHeightWorld(asset, clip) {
  return (
    (asset.renderSize.height / asset.videoBase.contentHeight) *
    clip.frameHeight *
    clip.scale
  );
}
function imageFeetAnchor(image) {
  if (!image) return { x: 0.5, y: 1 };
  if (image._feetAnchor) return image._feetAnchor;
  const width = image.naturalWidth,
    height = image.naturalHeight;
  if (!width || !height) return { x: 0.5, y: 1 };
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let y = height - 1; y >= 0; y--) {
    let sum = 0,
      count = 0;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        sum += x;
        count++;
      }
    }
    if (count) {
      image._feetAnchor = { x: (sum / count + 0.5) / width, y: (y + 1) / height };
      return image._feetAnchor;
    }
  }
  image._feetAnchor = { x: 0.5, y: 1 };
  return image._feetAnchor;
}
function drawArt(ctx, camera, entity, state, time = 0, options = {}) {
  const asset = assetById.get(entity.assetId);
  if (!asset) return false;
  const clip = clipFor(asset, state),
    facing = entity.facing || 1;
  let image,
    source = null,
    heightPx,
    widthPx,
    anchorX,
    anchorY;
  if (clip?.type === "sprite-sheet") {
    image = images[`${asset.id}:${clip.state}:sheet`];
    const index = frameIndex(clip, time);
    source = [index * clip.frameWidth, 0, clip.frameWidth, clip.frameHeight];
    heightPx = sh(
      camera,
      (asset.renderSize.height / asset.videoBase.contentHeight) *
        clip.frameHeight *
        clip.scale,
    );
    widthPx = heightPx * (clip.frameWidth / clip.frameHeight);
    anchorX = clip.anchor.x;
    anchorY = clip.anchor.y;
  } else if (clip?.type === "frames") {
    const index = frameIndex(clip, time);
    image = images[`${asset.id}:${clip.state}:${index}`];
    const idleSheet = idleSheetClip(asset);
    if (idleSheet) {
      heightPx = sh(camera, sheetHeightWorld(asset, idleSheet));
    } else {
      heightPx = sh(
        camera,
        asset.renderSize.height * clip.normalization.scaleMultiplier,
      );
    }
    widthPx = image
      ? (heightPx * image.naturalWidth) / image.naturalHeight
      : heightPx;
    if (asset.kind === "player" || asset.kind === "enemy") {
      const feet = imageFeetAnchor(image);
      anchorX = feet.x;
      anchorY = feet.y;
    } else {
      anchorX = clip.normalization.feetAnchor.x / 1000;
      anchorY = clip.normalization.feetAnchor.y / 1000;
    }
  } else {
    image = images[`${asset.id}:seed`];
    heightPx = sh(camera, asset.renderSize.height);
    widthPx = image
      ? (heightPx * image.naturalWidth) / image.naturalHeight
      : sw(camera, asset.renderSize.width);
    anchorX = asset.pivot?.[0] ?? 0.5;
    anchorY = asset.pivot?.[1] ?? 1;
  }
  if (!image) return false;
  const worldAnchor =
    asset.kind === "collectible" || asset.kind === "objective"
      ? point(camera, entity.x + entity.w / 2, entity.y + entity.h / 2)
      : point(camera, feetPoint(entity).x, feetPoint(entity).y);
  const scale = options.scale || 1;
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.translate(worldAnchor.x, worldAnchor.y);
  ctx.rotate(options.rotation || 0);
  ctx.scale(facing < 0 ? -scale : scale, scale);
  if (source)
    ctx.drawImage(
      image,
      ...source,
      -anchorX * widthPx,
      -anchorY * heightPx,
      widthPx,
      heightPx,
    );
  else
    ctx.drawImage(
      image,
      -anchorX * widthPx,
      -anchorY * heightPx,
      widthPx,
      heightPx,
    );
  ctx.restore();
  return true;
}

function drawBody(ctx, camera, entity, color, state, time, options) {
  if (drawArt(ctx, camera, entity, state, time, options)) return;
  const p = point(camera, entity.x, entity.y);
  ctx.save();
  ctx.globalAlpha = options?.alpha ?? 1;
  ctx.fillStyle = color;
  ctx.fillRect(p.x, p.y, sw(camera, entity.w), sh(camera, entity.h));
  ctx.restore();
}

function drawPrompt(ctx, camera, text) {
  if (!text) return;
  ctx.save();
  ctx.font = `bold ${uiPx(camera, 15)}px Georgia`;
  ctx.textAlign = "center";
  const pad = uiPx(camera, 24);
  const w = ctx.measureText(text).width + pad;
  const h = uiPx(camera, 28);
  const overlay = document.body.classList.contains("touch-overlay");
  const padCss =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--touch-pad-height",
      ),
    ) || 0;
  const padPx = overlay
    ? (padCss / Math.max(1, ctx.canvas.clientHeight)) * ctx.canvas.height
    : 0;
  const y = ctx.canvas.height - padPx - uiPx(camera, overlay ? 36 : 64);
  ctx.fillStyle = "rgba(9,7,4,.82)";
  ctx.fillRect((ctx.canvas.width - w) / 2, y, w, h);
  ctx.strokeStyle = "#c5ad74";
  ctx.lineWidth = uiPx(camera, 1);
  ctx.strokeRect((ctx.canvas.width - w) / 2, y, w, h);
  ctx.fillStyle = "#f3dfad";
  ctx.fillText(text, ctx.canvas.width / 2, y + uiPx(camera, 19));
  ctx.restore();
}

export function render(ctx, camera, player, enemies, collectibles, ui = {}) {
  const { canvas } = ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#17120b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (images.background) {
    const img = images.background;
    ctx.drawImage(
      img,
      0,
      0,
      img.width,
      img.height,
      sx(camera, 0),
      sy(camera, 0),
      sx(camera, WORLD_W) - sx(camera, 0),
      sy(camera, WORLD_H) - sy(camera, 0),
    );
  } else {
    ctx.fillStyle = "#2c2418";
    for (const platform of level.platforms) {
      const p = point(camera, platform.x, platform.y);
      ctx.fillRect(p.x, p.y, sw(camera, platform.w), sh(camera, platform.h));
    }
    ctx.fillStyle = "rgba(197, 173, 116, 0.55)";
    for (const door of level.doors) {
      const p = point(camera, door.x, door.y);
      ctx.fillRect(p.x, p.y, sw(camera, door.w), sh(camera, door.h));
    }
  }
  if (level.goal)
    drawBody(
      ctx,
      camera,
      level.goal,
      "#d4a017",
      ui.won ? "completed" : "idle",
      ui.winTime || 0,
    );
  for (const item of collectibles) {
    if (item.collected && item.collectAge > 0.35) continue;
    const age = item.collectAge,
      collecting = item.collected;
    drawBody(ctx, camera, item, "#f4d03f", "idle", ui.time, {
      rotation: collecting
        ? age * 5
        : Math.sin((ui.time || 0) * 2 + (item.phase || 0)) * 0.08,
      scale: collecting ? 1 + age * 1.5 : 1,
      alpha: collecting ? 1 - age / 0.35 : 1,
    });
  }
  for (const enemy of enemies) {
    if (enemy.dead && enemy.animTime > 0.55) continue;
    drawBody(ctx, camera, enemy, "#c0392b", enemy.visualState, enemy.animTime, {
      alpha: enemy.dead ? Math.max(0, 1 - enemy.animTime / 0.55) : 1,
    });
  }
  if (
    (player.invulnerable ?? 0) <= 0 ||
    Math.floor(player.invulnerable * 12) % 2 === 0
  )
    drawBody(
      ctx,
      camera,
      player,
      "#5dade2",
      player.visualState,
      player.animTime,
    );
  drawPrompt(ctx, camera, ui.prompt);
  if (debugState.showBBoxes)
    drawDebug(ctx, camera, player, enemies, collectibles);
}
function box(ctx, camera, item, color, label) {
  const p = point(camera, item.x, item.y);
  ctx.strokeStyle = color;
  ctx.strokeRect(p.x, p.y, sw(camera, item.w), sh(camera, item.h));
  ctx.fillStyle = color;
  ctx.fillText(label || item.id, p.x, p.y - 2);
}
function drawDebug(ctx, camera, player, enemies, collectibles) {
  ctx.save();
  ctx.font = `${uiPx(camera, 10)}px monospace`;
  level.platforms.forEach((item) => box(ctx, camera, item, "#52ff52"));
  level.doors.forEach((item) => box(ctx, camera, item, "#00eaff"));
  collectibles.forEach((item) => box(ctx, camera, item, "#ffd32a"));
  enemies.forEach((item) => box(ctx, camera, item, "#ff543d"));
  box(ctx, camera, player, "#fff", "player");
  const hit = player.visualState === "attack" ? attackBox(player) : null;
  if (hit) box(ctx, camera, hit, "#ff8cff", "attack");
  ctx.restore();
}
