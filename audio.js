const STORAGE_KEY = "capybara.audio";

export const AUDIO_CHANNELS = [
  { id: "music", label: "Music" },
  { id: "sfx", label: "Sound" },
  { id: "dialogue", label: "Dialogue" },
];

const DEFAULTS = {
  music: { on: true, volume: 0.45 },
  sfx: { on: true, volume: 0.75 },
  dialogue: { on: true, volume: 0.9 },
};

const listeners = new Set();
const buffers = new Map();
const decoding = new Map();
const htmlCache = new Map();
let settings = loadSettings();
let music = null;
let musicUrl = "./temp.mp3";
let musicWanted = false;
let outputSuspended = false;
let unlocked = false;
let audioCtx = null;
let masterGain = null;
let musicSource = null;
let musicGain = null;
let unlockBound = false;
let gestureResumeBound = false;
let dialogueHandle = null;
const liveHtml = new Set();

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function copyBus(bus) {
  return { on: !!bus.on, volume: clamp01(bus.volume) };
}

function copySettings(from) {
  return {
    music: copyBus(from.music),
    sfx: copyBus(from.sfx),
    dialogue: copyBus(from.dialogue),
  };
}

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return copySettings(DEFAULTS);
    return {
      music: copyBus({ ...DEFAULTS.music, ...raw.music }),
      sfx: copyBus({ ...DEFAULTS.sfx, ...raw.sfx }),
      dialogue: copyBus({ ...DEFAULTS.dialogue, ...raw.dialogue }),
    };
  } catch {
    return copySettings(DEFAULTS);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode / blocked storage — settings last for this page only.
  }
}

function notify() {
  const snapshot = getAudioSettings();
  for (const listener of listeners) listener(snapshot);
}

function tryPlay(element) {
  const play = element?.play?.();
  if (play && typeof play.catch === "function") {
    play.catch(() => armGestureResume());
  }
}

function contextNeedsResume(ctx = audioCtx) {
  return ctx && (ctx.state === "suspended" || ctx.state === "interrupted");
}

function resumeContext() {
  const ctx = getContext();
  if (!contextNeedsResume(ctx)) return Promise.resolve();
  return ctx.resume().catch(() => {});
}

function armGestureResume() {
  if (gestureResumeBound || typeof window === "undefined") return;
  gestureResumeBound = true;
  const once = () => {
    gestureResumeBound = false;
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
    window.removeEventListener("touchstart", once);
    if (outputSuspended) return;
    unlockAudio();
  };
  window.addEventListener("pointerdown", once);
  window.addEventListener("keydown", once);
  window.addEventListener("touchstart", once, { passive: true });
}

export function unlockAudio() {
  unlocked = true;
  return resumeContext().finally(() => {
    if (!outputSuspended && musicWanted) applyMusic();
  });
}

function getContext() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioCtx = new Ctx({ latencyHint: "interactive" });
  } catch {
    audioCtx = new Ctx();
  }
  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);
  return audioCtx;
}

function bindUnlock() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
}

function decodeBuffer(ctx, data) {
  const copy = data.slice(0);
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buffer) => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const result = ctx.decodeAudioData(copy, ok, fail);
    if (result && typeof result.then === "function") result.then(ok, fail);
  });
}

function preloadHtml(url) {
  if (!url || htmlCache.has(url)) return htmlCache.get(url) || null;
  const element = new Audio();
  element.preload = "auto";
  element.crossOrigin = "anonymous";
  element.src = url;
  htmlCache.set(url, element);
  return element;
}

async function decodeUrl(url) {
  if (!url) return null;
  if (buffers.has(url)) return buffers.get(url);
  if (decoding.has(url)) return decoding.get(url);
  preloadHtml(url);

  const job = (async () => {
    const ctx = getContext();
    if (!ctx) return null;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`audio ${response.status}`);
    const data = await response.arrayBuffer();
    const buffer = await decodeBuffer(ctx, data);
    buffers.set(url, buffer);
    return buffer;
  })().catch(() => null);

  decoding.set(url, job);
  const buffer = await job;
  decoding.delete(url);
  return buffer;
}

function playHtml(url, gain, loop) {
  const master = preloadHtml(url);
  const element = master.cloneNode();
  element.volume = Math.min(1, gain);
  element.loop = !!loop;
  try {
    if (element.readyState >= 1) element.currentTime = 0;
  } catch {
    // Metadata may not be ready yet on the first play.
  }
  liveHtml.add(element);
  const drop = () => liveHtml.delete(element);
  element.addEventListener("ended", drop, { once: true });
  tryPlay(element);
  return element;
}

function startBuffer(buffer, gain, loop) {
  const ctx = getContext();
  if (!ctx || !buffer) return null;
  if (ctx.state === "suspended") ctx.resume();

  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  source.buffer = buffer;
  source.loop = !!loop;
  gainNode.gain.value = gain;
  source.connect(gainNode);
  gainNode.connect(masterGain || ctx.destination);
  source.start(0);

  const handle = {
    paused: false,
    ended: false,
    _source: source,
    get loop() {
      return source.loop;
    },
    set loop(value) {
      source.loop = !!value;
    },
    pause() {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      this.paused = true;
      this.ended = true;
    },
    currentTime: 0,
  };
  source.onended = () => {
    handle.paused = true;
    handle.ended = true;
  };
  return handle;
}

function ensureMusic() {
  if (!music) {
    music = new Audio();
    music.loop = true;
    music.preload = "auto";
    music.crossOrigin = "anonymous";
  }
  if (music.getAttribute("data-url") !== musicUrl) {
    music.src = musicUrl;
    music.setAttribute("data-url", musicUrl);
  }
  return music;
}

function connectMusic(element) {
  const ctx = getContext();
  if (!ctx || musicSource) return !!musicSource;
  try {
    musicSource = ctx.createMediaElementSource(element);
    musicGain = ctx.createGain();
    musicSource.connect(musicGain);
    musicGain.connect(masterGain || ctx.destination);
    element.volume = 1;
    return true;
  } catch {
    musicSource = null;
    musicGain = null;
    return false;
  }
}

function applyMusic() {
  if (!music && !musicWanted) return;
  const el = ensureMusic();
  const routed = connectMusic(el);
  if (routed) musicGain.gain.value = settings.music.volume;
  else el.volume = settings.music.volume;
  if (
    outputSuspended ||
    !musicWanted ||
    !settings.music.on ||
    settings.music.volume <= 0
  ) {
    el.pause();
    return;
  }
  tryPlay(el);
}

export function setAudioOutputSuspended(suspended) {
  const next = !!suspended;
  if (outputSuspended === next) return;
  outputSuspended = next;
  if (outputSuspended) {
    music?.pause();
    for (const el of liveHtml) {
      if (el.paused) continue;
      el.dataset.pagePause = "1";
      el.pause();
    }
    if (audioCtx && audioCtx.state === "running") {
      audioCtx.suspend().catch(() => {});
    }
    armGestureResume();
    return;
  }
  applyMusic();
  resumeContext().finally(() => {
    applyMusic();
    for (const el of [...liveHtml]) {
      if (el.dataset.pagePause !== "1") continue;
      delete el.dataset.pagePause;
      tryPlay(el);
    }
  });
  armGestureResume();
}

export function channelGain(channel) {
  const bus = settings[channel];
  if (!bus) return 0;
  return bus.on ? bus.volume : 0;
}

export function getAudioSettings() {
  return copySettings(settings);
}

export function onAudioSettingsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAudioChannel(channel, patch = {}) {
  if (!settings[channel]) return getAudioSettings();
  const next = copyBus(settings[channel]);
  if ("on" in patch) next.on = !!patch.on;
  if ("volume" in patch) next.volume = clamp01(patch.volume);
  settings = { ...settings, [channel]: next };
  saveSettings();
  if (channel === "music") applyMusic();
  notify();
  return getAudioSettings();
}

export async function preloadAudio(urls = []) {
  bindUnlock();
  getContext();
  const unique = [...new Set(urls.filter(Boolean))];
  await Promise.all(unique.map((url) => decodeUrl(url)));
}

function playOneShot(channel, url, scale = 1, loop = false) {
  if (outputSuspended) return null;
  const gain = channelGain(channel) * clamp01(scale);
  if (!url || gain <= 0) return null;
  unlockAudio();

  const buffer = buffers.get(url);
  if (buffer) return startBuffer(buffer, gain, loop);

  decodeUrl(url);
  return playHtml(url, gain, loop);
}

export function playSfx(url, { volume = 1, loop = false } = {}) {
  return playOneShot("sfx", url, volume, loop);
}

export function playDialogue(url, { volume = 1 } = {}) {
  stopDialogue();
  dialogueHandle = playOneShot("dialogue", url, volume, false);
  return dialogueHandle;
}

export function stopDialogue() {
  const handle = dialogueHandle;
  dialogueHandle = null;
  if (!handle) return;
  try {
    handle.pause();
  } catch {
    // Already stopped or not a pauseable handle.
  }
}

export function getAudioDuration(url) {
  if (!url) return 0;
  const buffer = buffers.get(url);
  if (buffer && Number.isFinite(buffer.duration) && buffer.duration > 0) {
    return buffer.duration;
  }
  const html = htmlCache.get(url);
  const duration = html?.duration;
  if (Number.isFinite(duration) && duration > 0) return duration;
  return 0;
}

export function startBackgroundMusic(url = musicUrl) {
  if (url) musicUrl = url;
  if (!musicUrl) return;
  musicWanted = true;
  bindUnlock();
  unlockAudio();
  applyMusic();
}

bindUnlock();
