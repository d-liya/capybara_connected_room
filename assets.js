import { level } from "./levelData.js";

export const images = Object.create(null);

function load(key, url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = async () => {
      try {
        images[key] = await createImageBitmap(image);
      } catch {
        images[key] = image;
      }
      resolve(true);
    };
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

export async function loadAllAssets(onProgress) {
  const jobs = [];
  if (level.background?.url) jobs.push(["background", level.background.url]);
  for (const asset of level.assets || []) {
    if (asset.seedUrl) jobs.push([`${asset.id}:seed`, asset.seedUrl]);
    for (const clip of asset.clips || []) {
      if (clip.sheet) jobs.push([`${asset.id}:${clip.state}:sheet`, clip.sheet]);
      clip.frames?.forEach((url, i) =>
        jobs.push([`${asset.id}:${clip.state}:${i}`, url]),
      );
    }
  }
  let done = 0;
  await Promise.all(
    jobs.map(([key, url]) =>
      load(key, url).then((ok) => {
        done++;
        onProgress?.(done, jobs.length, key, ok);
      }),
    ),
  );
  return images;
}
