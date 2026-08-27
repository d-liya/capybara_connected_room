import { level } from "./levelData.js";

export const images = {};

function loadImage(name, url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => { images[name] = image; resolve(image); };
    image.onerror = () => reject(new Error(`Failed to load ${name}`));
    image.src = url;
  });
}

export async function loadAllAssets(onProgress) {
  const jobs = [
    ...(level.background.url ? [["background", level.background.url]] : []),
    ...Object.entries(level.assets),
  ];
  let done = 0;
  await Promise.all(jobs.map(([name, url]) => loadImage(name, url).then(() => {
    done += 1;
    onProgress?.(done, jobs.length, name);
  })));
  return images;
}
