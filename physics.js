// physics.js
export const GRAVITY = 2400;      // px/s^2, in native image-space units
export const MOVE_SPEED = 420;
export const JUMP_VELOCITY = -950;
export const MAX_FALL_SPEED = 1800;

export function aabbOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

// Resolve vertical landing on a platform: only counts if falling
// onto it from above (prevents snapping to platforms from the side).
export function resolvePlatformLanding(entity, platform) {
  const wasAbove = (entity.prevY + entity.h) <= platform.y + 1;
  const overlapsX = entity.x + entity.w > platform.x && entity.x < platform.x + platform.w;
  const fallingIntoTop =
    entity.y + entity.h >= platform.y &&
    entity.y + entity.h <= platform.y + platform.h + 40 &&
    entity.vy >= 0;

  if (overlapsX && fallingIntoTop && wasAbove) {
    entity.y = platform.y - entity.h;
    entity.vy = 0;
    entity.onGround = true;
    return true;
  }
  return false;
}

export function applyGravity(entity, dt) {
  entity.prevY = entity.y;
  entity.vy = Math.min(entity.vy + GRAVITY * dt, MAX_FALL_SPEED);
  entity.y += entity.vy * dt;
}

export function clampToWorld(entity, worldW, worldH) {
  if (entity.x < 0) entity.x = 0;
  if (entity.x + entity.w > worldW) entity.x = worldW - entity.w;
  if (entity.y + entity.h > worldH) {
    entity.y = worldH - entity.h;
    entity.vy = 0;
    entity.onGround = true;
  }
}
