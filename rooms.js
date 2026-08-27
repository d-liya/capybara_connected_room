import { level } from "./levelData.js";
import { takeAction } from "./input.js";
import { aabbOverlap } from "./physics.js";

const doorsById = new Map(level.doors.map((door) => [door.id, door]));
let cooldown = 0;

export function tickDoorCooldown(dt) {
  cooldown = Math.max(0, cooldown - dt);
}

export function getOverlappingDoor(player) {
  return level.doors.find((door) => aabbOverlap(player, door)) ?? null;
}

export function tryEnterDoor(player) {
  if (cooldown || !takeAction("interact")) return null;
  const from = getOverlappingDoor(player);
  const to = from ? doorsById.get(from.linksTo) : null;
  if (!from || !to) return null;
  player.x = to.x + (to.w - player.w) / 2;
  player.y = to.y + to.h - player.h;
  player.prevY = player.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  cooldown = 0.5;
  return { from, to };
}
