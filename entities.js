import { level } from "./levelData.js";
import { keys, takeAction } from "./input.js";
import {
  MOVE_SPEED,
  clamp,
  clampToFloor,
  configureBody,
  placeOnFloor,
} from "./physics.js";

function floorIndex(floor) {
  return level.floors.findIndex((item) => item.floor === floor);
}

export class Player {
  constructor() {
    const def = level.instances?.[0] ?? {
      floor: 1,
      x: level.floors[0].spawn.x,
      w: level.player.width,
      h: level.player.height,
      facing: 1,
      assetId: level.player.assetId,
    };
    Object.assign(this, {
      ...def,
      hp: 3,
      maxHp: 3,
      vx: 0,
      currentFloor: def.floor ?? 1,
      invulnerable: 0,
      dead: false,
      attackElapsed: 0,
      strikePulse: false,
      visualState: "idle",
      animTime: 0,
    });
    configureBody(this);
    placeOnFloor(this, this.currentFloor, this.x);
  }
  setVisual(state) {
    if (this.visualState !== state) {
      this.visualState = state;
      this.animTime = 0;
    }
  }
  place(floor, x) {
    Object.assign(this, { vx: 0, dead: false });
    placeOnFloor(this, floor, x);
    this.setVisual("idle");
  }
  retry() {
    const spawn = level.floors[floorIndex(this.currentFloor)].spawn;
    this.hp = this.maxHp;
    this.invulnerable = 0.7;
    this.place(this.currentFloor, spawn.x);
  }
  interact() {
    if (!this.dead && this.visualState !== "hurt") {
      this.setVisual("interact");
      this.actionTime = 0.38;
    }
  }
  update(dt, locked = false) {
    this.animTime += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.strikePulse = false;
    if (this.dead) {
      this.actionTime -= dt;
      return;
    }
    if (this.visualState === "hurt" || this.visualState === "interact") {
      this.actionTime -= dt;
      if (this.actionTime <= 0) this.setVisual("idle");
      return;
    }
    if (this.visualState === "attack") {
      const before = this.attackElapsed;
      this.attackElapsed += dt;
      if (before < 0.14 && this.attackElapsed >= 0.14) this.strikePulse = true;
      if (this.attackElapsed >= 0.42) this.setVisual("idle");
    } else if (takeAction("attack") && !locked) {
      this.attackElapsed = 0;
      this.setVisual("attack");
    }

    this.vx = 0;
    if (!locked) {
      if (keys.left && !keys.right) {
        this.vx = -MOVE_SPEED;
        this.facing = -1;
      }
      if (keys.right && !keys.left) {
        this.vx = MOVE_SPEED;
        this.facing = 1;
      }
    }
    const previousX = this.x;
    this.x += this.vx * dt;
    clampToFloor(this);
    const moved = Math.abs(this.x - previousX) > 0.05;
    if (this.visualState === "attack") return;
    this.setVisual(moved ? "walk" : "idle");
  }
}

export class Enemy {
  constructor(def) {
    Object.assign(this, { ...def });
    configureBody(this);
    this.start = { x: this.x, facing: def.facing ?? 1 };
    this.visualState = "idle";
    this.animTime = 0;
    this.facing = def.facing ?? 1;
    this.dead = false;
    snapHome(this);
    this.clampToPatrol();
  }
  setVisual(state) {
    if (this.visualState !== state) {
      this.visualState = state;
      this.animTime = 0;
    }
  }
  reset() {
    this.x = this.start.x;
    this.facing = this.start.facing;
    this.dead = false;
    configureBody(this);
    this.clampToPatrol();
    this.setVisual("idle");
  }
  clampToPatrol() {
    const zone = level.patrols?.[this.id];
    if (!zone) return;
    const min = zone.x;
    const max = zone.x + zone.w - this.w;
    if (max >= min) this.x = clamp(this.x, min, max);
  }
  update(dt, activeFloor) {
    this.animTime += dt;
    if (this.dead) return;
    if (activeFloor != null && this.floor !== activeFloor) {
      this.setVisual("idle");
      return;
    }
    const zone = level.patrols?.[this.id];
    if (!zone) {
      this.setVisual("idle");
      return;
    }
    const min = zone.x;
    const max = zone.x + zone.w - this.w;
    if (max <= min) {
      this.setVisual("idle");
      return;
    }
    const pace = (this.speed ?? 80) * 0.38;
    const previousX = this.x;
    this.x = clamp(this.x + this.facing * pace * dt, min, max);
    if (this.x === min || this.x === max) {
      this.facing = this.x === min ? 1 : -1;
      this.setVisual("idle");
    } else if (Math.abs(this.x - previousX) > 0.05) {
      this.setVisual("patrol");
    } else {
      this.setVisual("idle");
    }
  }
}

function snapHome(enemy) {
  if (enemy.floor) placeOnFloor(enemy, enemy.floor, enemy.x);
}

export function buildEntities() {
  return {
    player: new Player(),
    enemies: (level.enemies || []).map((def) => new Enemy(def)),
    collectibles: (level.collectibles || []).map((item) => ({
      ...item,
      collected: false,
      collectAge: 0,
      phase: Math.random() * 6.28,
    })),
  };
}
