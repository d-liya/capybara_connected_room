// levelData.js
// All coordinates are in the SOURCE IMAGE's native pixel space
// (imageWidth x imageHeight). The renderer scales everything to
// fit the canvas, so you only ever edit numbers here.

export const level = {
  name: "moonlit-tower-1",

  background: {
    url: "https://assets.capybara.build/platformer-v4/moonlit-full-1787790577814/clean-environment.png",
    width: 2560,
    height: 1381
  },

  objective: "Recover the Star Map at the rooftop telescope.",

  // player spawn point (native image coords, feet position)
  spawn: { x: 380, y: 1310 },

  // Solid ground/shelves the player and enemies can stand on.
  // y = top surface of the platform.
  platforms: [
    { id: "shelf5", x: 0,    y: 372, w: 2560, h: 30 },
    { id: "shelf4", x: 0,    y: 702, w: 2560, h: 30 },
    { id: "shelf3", x: 0,    y: 1032, w: 2560, h: 30 },
    { id: "shelf2", x: 0,    y: 1172, w: 2560, h: 30 },
    { id: "shelf1", x: 0,    y: 1312, w: 2560, h: 30 }
  ],

  // Non-solid hazards: overlap = damage, no collision resolution
  hazards: [
    { id: "spikes1", x: 460,  y: 995, w: 165, h: 45, type: "spike" },
    { id: "spikes2", x: 855,  y: 995, w: 165, h: 45, type: "spike" },
    { id: "spikes3", x: 1660, y: 995, w: 165, h: 45, type: "spike" },
    { id: "spikes4", x: 1990, y: 995, w: 165, h: 45, type: "spike" }
  ],

  // Paired doors: walking in + jump/up teleports to linksTo partner.
  doors: [
    { id: "door5-left",  x: 195,  y: 175, w: 95, h: 135, symbol: "star",      linksTo: "door5-right" },
    { id: "door5-right", x: 2255, y: 175, w: 95, h: 135, symbol: "star",      linksTo: "door5-left" },
    { id: "door4-left",  x: 195,  y: 505, w: 95, h: 135, symbol: "moon",      linksTo: "door4-right" },
    { id: "door4-right", x: 2255, y: 505, w: 95, h: 135, symbol: "moon",      linksTo: "door4-left" },
    { id: "door3-left",  x: 195,  y: 835, w: 95, h: 135, symbol: "butterfly", linksTo: "door3-right" },
    { id: "door3-right", x: 2255, y: 835, w: 95, h: 135, symbol: "butterfly", linksTo: "door3-left" }
  ],

  // Items the player can pick up. type maps to a small icon/effect.
  collectibles: [
    { id: "starmap", x: 2195, y: 145, w: 130, h: 105, type: "starmap" }
  ],

  // Enemies: type controls AI behavior in entities.js
  enemies: [
    { id: "shieldbot1", type: "shooter", x: 1660, y: 230, patrolMin: 1600, patrolMax: 1950, facing: -1 },
    { id: "rockling1",  type: "patrol",  x: 300,  y: 1245, patrolMin: 250,  patrolMax: 900, facing: 1 },
    { id: "rockling2",  type: "flyer",   x: 1300, y: 830,  patrolMin: 1150, patrolMax: 1500, facing: -1 }
  ]
};

// ---- Sprite sheet definitions ----
// Every sprite sheet is loaded from a URL. frameW/frameH is the size
// of a single frame in the sheet; animations reference row/col ranges.
export const spriteSheets = {
  player: {
    url: "https://assets.capybara.build/platformer-v4/moonlit-full-1787790577814/player-spritesheet.png",
    frameW: 64,
    frameH: 64,
    animations: {
      idle: { row: 0, frames: 4, fps: 6, loop: true },
      run:  { row: 1, frames: 6, fps: 12, loop: true },
      jump: { row: 2, frames: 2, fps: 6, loop: false },
      cast: { row: 3, frames: 5, fps: 12, loop: false }
    }
  },
  spark: {
    url: "https://assets.capybara.build/platformer-v4/moonlit-full-1787790577814/spark-spritesheet.png",
    frameW: 32,
    frameH: 32,
    animations: {
      float: { row: 0, frames: 4, fps: 8, loop: true }
    }
  },
  shooter: {
    url: "https://assets.capybara.build/platformer-v4/moonlit-full-1787790577814/shooter-spritesheet.png",
    frameW: 64,
    frameH: 64,
    animations: {
      idle:  { row: 0, frames: 4, fps: 6, loop: true },
      shoot: { row: 1, frames: 4, fps: 10, loop: false }
    }
  },
  rockling: {
    url: "https://assets.capybara.build/platformer-v4/moonlit-full-1787790577814/rockling-spritesheet.png",
    frameW: 48,
    frameH: 48,
    animations: {
      roll: { row: 0, frames: 6, fps: 10, loop: true },
      hurt: { row: 1, frames: 3, fps: 8, loop: false }
    }
  }
};
