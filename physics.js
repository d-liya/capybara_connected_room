import { assetById, floorById, level } from "./levelData.js";

export const MOVE_SPEED = 150;

export function configureBody(entity, assetId = entity.assetId) {
  const asset = assetById.get(assetId);
  if (!asset) return entity;
  entity.w = asset.renderSize.width;
  entity.h = asset.renderSize.height;
  return snapToFloor(entity);
}

export function snapToFloor(entity) {
  const floor = floorById.get(entity.currentFloor ?? entity.floor);
  if (floor) entity.y = floor.groundY - entity.h;
  return entity;
}

export function placeOnFloor(entity, floor, x) {
  entity.currentFloor = floor;
  entity.floor = floor;
  entity.x = x;
  return snapToFloor(entity);
}

export function feetPoint(entity) {
  const floor = floorById.get(entity.currentFloor ?? entity.floor);
  return {
    x: entity.x + entity.w / 2,
    y: floor?.groundY ?? entity.y + entity.h,
  };
}

export function aabbOverlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
export function centerX(entity) {
  return entity.x + entity.w / 2;
}
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
export function clampToFloor(entity) {
  const { walkMin, walkMax } = level.bounds;
  entity.x = clamp(entity.x, walkMin, walkMax - entity.w);
  snapToFloor(entity);
}
export function attackBox(player) {
  return player.facing > 0
    ? { x: player.x + player.w - 8, y: player.y + 20, w: 76, h: player.h - 25 }
    : { x: player.x - 68, y: player.y + 20, w: 76, h: player.h - 25 };
}
