// assets.js
// Centralized loader for URL-based images (background + spritesheets).
// Everything is fetched via new Image().src = url — no bundling needed.

import { level, spriteSheets } from "./levelData.js";

export const images = {}; // name -> HTMLImageElement

function loadImage(name, url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // needed if assets are on another domain + you read pixels
    img.onload = () => { images[name] = img; resolve(img); };
    img.onerror = () => reject(new Error(`Failed to load asset "${name}" from ${url}`));
    img.src = url;
  });
}

export async function loadAllAssets(onProgress) {
  const jobs = [];
  jobs.push(["background", level.background.url]);
  for (const [key, sheet] of Object.entries(spriteSheets)) {
    jobs.push([`sheet:${key}`, sheet.url]);
  }

  let done = 0;
  const total = jobs.length;

  await Promise.all(jobs.map(([name, url]) =>
    loadImage(name, url).then(() => {
      done++;
      if (onProgress) onProgress(done, total, name);
    })
  ));

  return images;
}
