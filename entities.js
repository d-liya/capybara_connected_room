import { level } from "./levelData.js";
import { keys, takeAction } from "./input.js";
import {
  MOVE_SPEED,
  JUMP_VELOCITY,
  applyGravity,
  clampToWorld,
  resolvePlatformLanding,
} from "./physics.js";

export class Player {
  constructor(spawn) {
    this.spawn = { ...spawn };
    this.w = level.player.width;
    this.h = level.player.height;
    this.hp = 3;
    this.facing = 1;
    this.reset();
  }

  reset() {
    this.x = this.spawn.x - this.w / 2;
    this.y = this.spawn.y - this.h;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }

  update(dt) {
    if (takeAction("reset")) this.reset();
    this.vx = 0;
    if (keys.left) { this.vx = -MOVE_SPEED; this.facing = -1; }
    if (keys.right) { this.vx = MOVE_SPEED; this.facing = 1; }
    if (keys.jump && this.onGround) this.vy = JUMP_VELOCITY;
    this.x += this.vx * dt;
    applyGravity(this, dt);
    this.onGround = false;
    for (const platform of level.platforms) resolvePlatformLanding(this, platform);
    clampToWorld(this, level.background.width, level.background.height);
  }
}

export class Enemy {
  constructor(definition) {
    Object.assign(this, definition);
    this.w ??= 56;
    this.h ??= 72;
    this.direction = this.direction ?? 1;
  }

  update(dt) {
    if (this.patrolMin == null || this.patrolMax == null) return;
    this.x += (this.speed ?? 80) * this.direction * dt;
    if (this.x <= this.patrolMin || this.x + this.w >= this.patrolMax) {
      this.direction *= -1;
      this.x = Math.max(this.patrolMin, Math.min(this.x, this.patrolMax - this.w));
    }
  }
}

export function buildEntities() {
  return {
    player: new Player(level.spawn),
    enemies: level.enemies.map((enemy) => new Enemy(enemy)),
    collectibles: level.collectibles.map((item) => ({ ...item, collected: false })),
  };
}
