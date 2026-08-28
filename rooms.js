import { level, floorById } from "./levelData.js";
import { aabbOverlap } from "./physics.js";

let cooldown = 0;
export function tickDoorCooldown(dt) {
  cooldown = Math.max(0, cooldown - dt);
}
export function getOverlappingDoor(player, floor) {
  return (
    level.doors.find(
      (door) => door.floor === floor && aabbOverlap(player, door),
    ) || null
  );
}
export function tryEnterDoor(player, floor, allowed = true) {
  const door = getOverlappingDoor(player, floor);
  if (!door) return { ok: false, reason: "No marked door is within reach." };
  if (cooldown) return { ok: false, silent: true };
  if (!allowed)
    return {
      ok: false,
      door,
      reason: "That route is still locked by unfinished business.",
    };
  const destination = floorById.get(door.toFloor);
  const enterX =
    door.toSide === "right"
      ? (destination.spawn.rightX ?? level.bounds.enterRightX)
      : destination.spawn.x;
  player.place(door.toFloor, enterX);
  cooldown = 0.55;
  return { ok: true, door, toFloor: door.toFloor };
}
