// entities.js
import { level, spriteSheets } from "./levelData.js";
import { images } from "./assets.js";
import { keys } from "./input.js";
import {
  MOVE_SPEED, JUMP_VELOCITY,
  aabbOverlap, applyGravity, resolvePlatformLanding, clampToWorld
} from "./physics.js";

// ---- Sprite animator: steps through frames of a sheet by name ----
export class Animator {
  constructor(sheetKey) {
    this.sheetKey = sheetKey;
    this.sheet = spriteSheets[sheetKey];
    this.current = Object.keys(this.sheet.animations)[0];
    this.frame = 0;
    this.timer = 0;
    this.facing = 1;
  }

  play(name) {
    if (this.current !== name) {
      this.current = name;
      this.frame = 0;
      this.timer = 0;
    }
  }

  update(dt) {
    const anim = this.sheet.animations[this.current];
    this.timer += dt;
    const frameDuration = 1 / anim.fps;
    if (this.timer >= frameDuration) {
      this.timer -= frameDuration;
      this.frame++;
      if (this.frame >= anim.frames) {
        this.frame = anim.loop ? 0 : anim.frames - 1;
      }
    }
  }

  // Draws current frame at (x, y, w, h) in DESTINATION (canvas) space
  draw(ctx, x, y, w, h) {
    const img = images[`sheet:${this.sheetKey}`];
    if (!img) return;
    const anim = this.sheet.animations[this.current];
    const sx = this.frame * this.sheet.frameW;
    const sy = anim.row * this.sheet.frameH;

    ctx.save();
    if (this.facing < 0) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, this.sheet.frameW, this.sheet.frameH, 0, 0, w, h);
    } else {
      ctx.drawImage(img, sx, sy, this.sheet.frameW, this.sheet.frameH, x, y, w, h);
    }
    ctx.restore();
  }
}

// ---- Player ----
export class Player {
  constructor(spawn) {
    this.x = spawn.x - 32;
    this.y = spawn.y - 64;
    this.w = 64;
    this.h = 64;
    this.vx = 0;
    this.vy = 0;
    this.prevY = this.y;
    this.onGround = false;
    this.hp = 3;
    this.invuln = 0;
    this.anim = new Animator("player");
  }

  update(dt) {
    // horizontal movement
    this.vx = 0;
    if (keys.left)  { this.vx = -MOVE_SPEED; this.anim.facing = -1; }
    if (keys.right) { this.vx = MOVE_SPEED;  this.anim.facing = 1; }
    this.x += this.vx * dt;

    if (keys.jump && this.onGround) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
    }

    applyGravity(this, dt);

    this.onGround = false;
    for (const p of level.platforms) {
      resolvePlatformLanding(this, p);
    }

    clampToWorld(this, level.background.width, level.background.height);

    // animation state
    if (!this.onGround) this.anim.play("jump");
    else if (keys.cast) this.anim.play("cast");
    else if (this.vx !== 0) this.anim.play("run");
    else this.anim.play("idle");

    this.anim.update(dt);

    if (this.invuln > 0) this.invuln -= dt;

    // hazards
    for (const h of level.hazards) {
      if (aabbOverlap(this, h) && this.invuln <= 0) {
        this.hp -= 1;
        this.invuln = 1.2;
        this.vy = -600; // knockback
      }
    }
  }
}

// ---- Enemy (patrol / shooter / flyer share this, AI branches by type) ----
export class Enemy {
  constructor(def) {
    Object.assign(this, def);
    this.w = 64;
    this.h = 64;
    this.vx = this.facing * 150;
    this.vy = 0;
    this.prevY = this.y;
    this.onGround = true;
    this.anim = new Animator(def.type === "shooter" ? "shooter" : "rockling");
    this.anim.facing = this.facing;
  }

  update(dt) {
    if (this.type === "patrol" || this.type === "flyer") {
      this.x += this.vx * dt;
      if (this.x < this.patrolMin) { this.x = this.patrolMin; this.vx *= -1; this.anim.facing *= -1; }
      if (this.x > this.patrolMax) { this.x = this.patrolMax; this.vx *= -1; this.anim.facing *= -1; }
      this.anim.play(this.type === "flyer" ? "roll" : "roll");
    }

    if (this.type === "shooter") {
      // stays put, just idles/faces the player-ward direction (extend with real shooting logic)
      this.anim.play("idle");
    }

    if (this.type !== "flyer") {
      applyGravity(this, dt);
      for (const p of level.platforms) resolvePlatformLanding(this, p);
    }

    this.anim.update(dt);
  }
}

// ---- Collectible ----
export class Collectible {
  constructor(def) {
    Object.assign(this, def);
    this.collected = false;
  }
}

export function buildEntities() {
  const player = new Player(level.spawn);
  const enemies = level.enemies.map(e => new Enemy(e));
  const collectibles = level.collectibles.map(c => new Collectible(c));
  return { player, enemies, collectibles };
}
