import { level, assetById } from "./levelData.js";
import { images } from "./assets.js";
import { debugState } from "./input.js";
import { attackBox, clamp, feetPoint } from "./physics.js";

const WORLD_W = level.bounds.width;
const WORLD_H = level.bounds.height;
const DESIGN_W = level.bounds.width;
const DESIGN_H = (level.bounds.width * 9) / 16;

const layout = {
  cssW: 1,
  cssH: 1,
  pad: null,
  overlay: false,
  padH: 0,
};

function pixelRatio() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

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

export function invalidateLayout() {
  layout.pad = null;
}

export function syncCanvasSize(canvas) {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const dpr = pixelRatio();
  const bufferW = Math.round(width * dpr);
  const bufferH = Math.round(height * dpr);
  if (
    layout.cssW !== width ||
    layout.cssH !== height ||
    canvas.width !== bufferW ||
    canvas.height !== bufferH
  ) {
    layout.pad = null;
  }
  layout.cssW = width;
  layout.cssH = height;
  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW;
    canvas.height = bufferH;
  }
}

function chooseView(canvas) {
  const cssW = layout.cssW || Math.max(1, canvas.clientWidth);
  const cssH = layout.cssH || Math.max(1, canvas.clientHeight);
  return {
    viewW: Math.min(WORLD_W, cssW * (WORLD_W / DESIGN_W)),
    viewH: Math.min(WORLD_H, cssH * (WORLD_H / DESIGN_H)),
  };
}

function paddingWorld(camera) {
  if (
    layout.pad &&
    layout.viewW === camera.viewW &&
    layout.viewH === camera.viewH
  ) {
    return layout.pad;
  }
  const { viewW, viewH } = camera;
  const cssW = layout.cssW;
  const cssH = layout.cssH;
  const hud = document.getElementById("hud");
  const hudBottom = hud?.getBoundingClientRect().bottom ?? 88;
  const styles = getComputedStyle(document.documentElement);
  const safeBottom = parseFloat(styles.getPropertyValue("--safe-bottom")) || 0;
  const overlay = document.body.classList.contains("touch-overlay");
  const padH =
    parseFloat(styles.getPropertyValue("--touch-pad-height")) || 0;
  layout.overlay = overlay;
  layout.padH = padH;
  layout.viewW = viewW;
  layout.viewH = viewH;
  const topCss = hudBottom + 20;
  const bottomCss = overlay ? padH + 10 : 56 + safeBottom;
  const xCss = Math.min(48, cssW * 0.1);
  layout.pad = {
    top: (topCss / cssH) * viewH,
    bottom: (bottomCss / cssH) * viewH,
    x: (xCss / cssW) * viewW,
  };
  return layout.pad;
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

function followZoom() {
  const zoom = Number(level.camera?.followZoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
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
  const zoom = followZoom();
  const probe = {
    canvas: camera.canvas,
    x: camera.x,
    y: camera.y,
    viewW: view.viewW / zoom,
    viewH: view.viewH / zoom,
    zoom,
    ready: true,
  };
  const pose = followTarget(probe, player);
  return {
    x: pose.x + probe.viewW / 2,
    y: pose.y + probe.viewH / 2,
    zoom,
  };
}

export function updateCamera(camera, player, dt = 0) {
  if (camera.scripted) {
    applyZoomView(camera, camera.zoom || followZoom(), true);
    return;
  }
  applyZoomView(camera, followZoom(), false);
  const target = followTarget(camera, player);
  if (!camera.ready) {
    camera.x = target.x;
    camera.y = target.y;
    camera.ready = true;
    snapCameraToPixels(camera);
    return;
  }
  const t = 1 - Math.exp(-18 * Math.max(dt, 0));
  camera.x += (target.x - camera.x) * t;
  camera.y += (target.y - camera.y) * t;
  snapCameraToPixels(camera);
}

function snapCameraToPixels(camera) {
  const xs = scaleX(camera);
  const ys = scaleY(camera);
  if (xs) camera.x = Math.round(camera.x * xs) / xs;
  if (ys) camera.y = Math.round(camera.y * ys) / ys;
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
  return size * (camera.canvas.width / Math.max(1, layout.cssW));
}

function imgSize(image) {
  return {
    width: image.naturalWidth || image.width || 0,
    height: image.naturalHeight || image.height || 0,
  };
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
const feetAnchors = new WeakMap();

function imageFeetAnchor(image) {
  if (!image) return { x: 0.5, y: 1 };
  const cached = feetAnchors.get(image);
  if (cached) return cached;
  const { width, height } = imgSize(image);
  if (!width || !height) return { x: 0.5, y: 1 };
  const maxDim = 64;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let anchor = { x: 0.5, y: 1 };
  for (let y = h - 1; y >= 0; y--) {
    let sum = 0,
      count = 0;
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        sum += x;
        count++;
      }
    }
    if (count) {
      anchor = { x: (sum / count + 0.5) / w, y: (y + 1) / h };
      break;
    }
  }
  feetAnchors.set(image, anchor);
  return anchor;
}

export function warmImageAnchors(imageMap = images) {
  for (const [key, image] of Object.entries(imageMap)) {
    if (key === "background" || key.endsWith(":sheet")) continue;
    imageFeetAnchor(image);
  }
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
    const frameSize = image ? imgSize(image) : null;
    widthPx = frameSize
      ? (heightPx * frameSize.width) / frameSize.height
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
    const seedSize = image ? imgSize(image) : null;
    widthPx = seedSize
      ? (heightPx * seedSize.width) / seedSize.height
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
  ctx.translate(Math.round(worldAnchor.x), Math.round(worldAnchor.y));
  ctx.rotate(options.rotation || 0);
  ctx.scale(facing < 0 ? -scale : scale, scale);
  const dx = -anchorX * widthPx;
  const dy = -anchorY * heightPx;
  if (source)
    ctx.drawImage(image, ...source, dx, dy, widthPx, heightPx);
  else ctx.drawImage(image, dx, dy, widthPx, heightPx);
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
  const overlay = layout.overlay;
  const padPx = overlay
    ? (layout.padH / Math.max(1, layout.cssH)) * ctx.canvas.height
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";
  ctx.fillStyle = "#17120b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (images.background) {
    const img = images.background;
    const size = imgSize(img);
    ctx.drawImage(
      img,
      0,
      0,
      size.width,
      size.height,
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
