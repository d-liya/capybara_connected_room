// rooms.js
// Door pairing + teleport. Same-background "connected rooms" for now;
// swap onDoorEnter later to load a different room def if you go multi-bg.

import { level } from "./levelData.js";
import { aabbOverlap } from "./physics.js";
import { keys } from "./input.js";

const doorsById = Object.fromEntries(level.doors.map((d) => [d.id, d]));

/** @type {Map<string, object>} doorId -> partner door */
export const doorPartners = new Map();
for (const door of level.doors) {
  const partner = doorsById[door.linksTo];
  if (partner) doorPartners.set(door.id, partner);
}

const COOLDOWN = 0.6; // seconds after teleport before another enter
let cooldown = 0;
let jumpWasDown = false; // rising-edge so hold-jump does not ping-pong

export function tickDoorCooldown(dt) {
  if (cooldown > 0) cooldown -= dt;
}

/** Door the player is currently overlapping, or null. */
export function getOverlappingDoor(player) {
  for (const door of level.doors) {
    if (aabbOverlap(player, door)) return door;
  }
  return null;
}

/**
 * If overlapping a door and jump/up was just pressed, teleport to the partner.
 * Returns { from, to } on success, or null.
 * Caller should run onDoorEnter(from, to, player) for extension hooks.
 */
export function tryEnterDoor(player) {
  const jumpDown = keys.jump;
  const jumpPressed = jumpDown && !jumpWasDown;
  jumpWasDown = jumpDown;

  if (cooldown > 0 || !jumpPressed) return null;

  const from = getOverlappingDoor(player);
  if (!from) return null;

  const to = doorPartners.get(from.id);
  if (!to) return null;

  // Place player feet on the destination door floor, centered in the doorway.
  player.x = to.x + (to.w - player.w) / 2;
  player.y = to.y + to.h - player.h;
  player.vx = 0;
  player.vy = 0;
  player.prevY = player.y;
  player.onGround = true;

  cooldown = COOLDOWN;
  return { from, to };
}
