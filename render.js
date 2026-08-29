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

function stageRect() {
  return (
    document.getElementById("game")?.getBoundingClientRect() || {
      top: 0,
      bottom: layout.cssH,
      left: 0,
      right: layout.cssW,
      width: layout.cssW,
      height: layout.cssH,
    }
  );
}

function overlappingChrome(el, stage, edge) {
  if (!el) return 0;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return 0;
  if ((parseFloat(style.opacity) || 0) <= 0.08) return 0;
  const box = el.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return 0;
  const top = Math.max(box.top, stage.top);
  const bottom = Math.min(box.bottom, stage.bottom);
  if (bottom - top < 2) return 0;
  return edge === "top" ? bottom - stage.top : stage.bottom - top;
}

function overlayCss() {
  const cssW = Math.max(1, layout.cssW);
  const cssH = Math.max(1, layout.cssH);
  const stage = stageRect();
  const styles = getComputedStyle(document.documentElement);
  const safeBottom = parseFloat(styles.getPropertyValue("--safe-bottom")) || 0;
  const overlay = document.body.classList.contains("touch-overlay");
  const padH = parseFloat(styles.getPropertyValue("--touch-pad-height")) || 0;
  let topCss = overlappingChrome(document.getElementById("hud"), stage, "top");
  if (topCss) topCss += 16;
  else topCss = 64;
  let bottomCss = 36 + safeBottom;
  if (overlay) {
    bottomCss = Math.max(bottomCss, Math.min(padH, cssH * 0.22) + 8);
  } else {
    const hit = overlappingChrome(
      document.getElementById("controls"),
      stage,
      "bottom",
    );
    if (hit) bottomCss = Math.max(bottomCss, hit + 10);
  }
  const maxChrome = cssH * 0.42;
  topCss = Math.min(topCss, maxChrome);
  bottomCss = Math.min(bottomCss, maxChrome);
  if (topCss + bottomCss > cssH * 0.68) {
    const scale = (cssH * 0.68) / (topCss + bottomCss);
    topCss *= scale;
    bottomCss *= scale;
  }
  return {
    cssW,
    cssH,
    topCss,
    bottomCss,
    xCss: Math.min(48, cssW * 0.08),
    overlay,
    padH,
  };
}

function cameraConfig() {
  const cam = level.camera || {};
  const overlay = document.body.classList.contains("touch-overlay");
  return {
    focusPad: Number(cam.focusPad) > 0 ? Number(cam.focusPad) : 0.12,
    maxZoom: Number(cam.maxZoom) > 0 ? Number(cam.maxZoom) : 1.6,
    followZoom: Number(cam.followZoom) > 0 ? Number(cam.followZoom) : 1,
    overlayZoom: Number(cam.overlayZoom) > 0 ? Number(cam.overlayZoom) : 1.35,
    overlay,
  };
}

function subjectHeight(player) {
  return Math.max(
    24,
    Number(player?.h) || Number(level.player?.height) || 96,
  );
}

function paddingWorld(camera) {
  const { viewW, viewH } = camera;
  const hud = overlayCss();
  layout.overlay = hud.overlay;
  layout.padH = hud.padH;
  layout.viewW = viewW;
  layout.viewH = viewH;
  layout.pad = {
    top: (hud.topCss / hud.cssH) * viewH,
    bottom: (hud.bottomCss / hud.cssH) * viewH,
    x: (hud.xCss / hud.cssW) * viewW,
  };
  return layout.pad;
}

function followTarget(camera, player) {
  const { viewW, viewH } = camera;
  const pad = paddingWorld(camera);
  const cfg = cameraConfig();
  const height = subjectHeight(player);
  const width = Math.max(24, Number(player?.w) || Number(level.player?.width) || 56);
  const px = player.x + width / 2;
  const py = player.y + height / 2;
  const clearH = Math.max(1, viewH - pad.top - pad.bottom);
  const clearW = Math.max(1, viewW - pad.x * 2);
  const innerY = Math.min(
    clearH * 0.34,
    Math.max(height * 0.55, clearH * cfg.focusPad),
  );
  const innerX = Math.min(
    clearW * 0.34,
    Math.max(width * 0.8, clearW * 0.08),
  );
  const midX = pad.x + innerX + (clearW - innerX * 2) / 2;
  const midY = pad.top + innerY + (clearH - innerY * 2) / 2;
  return {
    x: clamp(px - midX, 0, Math.max(0, WORLD_W - viewW)),
    y: clamp(py - midY, 0, Math.max(0, WORLD_H - viewH)),
  };
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
  const cfg = cameraConfig();
  const base = cfg.followZoom || 1;
  if (!cfg.overlay) return clamp(base, 1, cfg.maxZoom);
  return clamp(Math.max(base, cfg.overlayZoom), 1, cfg.maxZoom);
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
  syncCanvasSize(camera.canvas);
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
  const settled =
    Math.abs(target.x - camera.x) < 0.2 &&
    Math.abs(target.y - camera.y) < 0.2;
  if (settled) snapCameraToPixels(camera);
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
  const idle = idleSheetClip(asset);
  const scaleClip = idle || clip;
  return (
    (asset.renderSize.height / asset.videoBase.contentHeight) *
    scaleClip.frameHeight *
    scaleClip.scale
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
    heightPx = sh(camera, sheetHeightWorld(asset, clip));
    widthPx = heightPx * (clip.frameWidth / clip.frameHeight);
    const idle = idleSheetClip(asset);
    anchorX = clip.anchor?.x ?? idle?.anchor?.x ?? 0.5;
    anchorY = clip.anchor?.y ?? idle?.anchor?.y ?? 1;
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
  const drawScaleX = options.scaleX ?? scale;
  const drawScaleY = options.scaleY ?? scale;
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.translate(worldAnchor.x, worldAnchor.y);
  ctx.rotate(options.rotation || 0);
  ctx.scale(facing < 0 ? -drawScaleX : drawScaleX, drawScaleY);
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
  ctx.font = `bold ${uiPx(camera, 15)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const overlay = layout.overlay;
  const padPx = overlay
    ? (layout.padH / Math.max(1, layout.cssH)) * ctx.canvas.height
    : 0;
  const y = ctx.canvas.height - padPx - uiPx(camera, overlay ? 28 : 52);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = uiPx(camera, 4);
  ctx.strokeText(text, ctx.canvas.width / 2, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, ctx.canvas.width / 2, y);
  ctx.restore();
}

export function render(ctx, camera, player, actors, collectibles, ui = {}) {
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
    const spin =
      0.16 +
      Math.abs(Math.cos((ui.time || 0) * 3.4 + (item.phase || 0))) * 0.84;
    drawBody(ctx, camera, item, "#f4d03f", "idle", ui.time, {
      rotation: collecting ? age * 5 : 0,
      scale: collecting ? 1 + age * 1.5 : 1,
      scaleX: collecting ? 1 + age * 1.5 : spin,
      alpha: collecting ? 1 - age / 0.35 : 1,
    });
  }
  for (const actor of actors) {
    if (actor.dead && actor.animTime > 0.55) continue;
    drawBody(ctx, camera, actor, "#c0392b", actor.visualState, actor.animTime, {
      alpha: actor.dead ? Math.max(0, 1 - actor.animTime / 0.55) : 1,
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
    drawDebug(ctx, camera, player, actors, collectibles);
}
function box(ctx, camera, item, color, label) {
  const p = point(camera, item.x, item.y);
  ctx.strokeStyle = color;
  ctx.strokeRect(p.x, p.y, sw(camera, item.w), sh(camera, item.h));
  ctx.fillStyle = color;
  ctx.fillText(label || item.id, p.x, p.y - 2);
}
function drawDebug(ctx, camera, player, actors, collectibles) {
  ctx.save();
  ctx.font = `${uiPx(camera, 10)}px monospace`;
  level.platforms.forEach((item) => box(ctx, camera, item, "#52ff52"));
  level.doors.forEach((item) => box(ctx, camera, item, "#00eaff"));
  collectibles.forEach((item) => box(ctx, camera, item, "#ffd32a"));
  actors.forEach((item) => box(ctx, camera, item, "#ff543d"));
  box(ctx, camera, player, "#fff", "player");
  const hit = player.visualState === "attack" ? attackBox(player) : null;
  if (hit) box(ctx, camera, hit, "#ff8cff", "attack");
  ctx.restore();
}
