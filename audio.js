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
let settings = loadSettings();
let music = null;
let musicUrl = "./temp.mp3";
let musicWanted = false;
let unlocked = false;

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
  if (play && typeof play.catch === "function") play.catch(() => {});
}

function bindUnlock() {
  if (unlocked || typeof window === "undefined") return;
  const unlock = () => {
    unlocked = true;
    if (musicWanted) applyMusic();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
}

function ensureMusic() {
  if (!music) {
    music = new Audio();
    music.loop = true;
  }
  if (music.getAttribute("data-url") !== musicUrl) {
    music.src = musicUrl;
    music.setAttribute("data-url", musicUrl);
  }
  return music;
}

function applyMusic() {
  if (!music && !musicWanted) return;
  const el = ensureMusic();
  el.volume = settings.music.volume;
  if (!musicWanted || !settings.music.on || settings.music.volume <= 0) {
    el.pause();
    return;
  }
  tryPlay(el);
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

function playOneShot(channel, url, scale = 1) {
  const gain = channelGain(channel) * clamp01(scale);
  if (!url || gain <= 0) return null;
  const element = new Audio(url);
  element.volume = Math.min(1, gain);
  tryPlay(element);
  return element;
}

export function playSfx(url, { volume = 1 } = {}) {
  return playOneShot("sfx", url, volume);
}

export function playDialogue(url, { volume = 1 } = {}) {
  return playOneShot("dialogue", url, volume);
}

export function startBackgroundMusic(url = musicUrl) {
  if (url) musicUrl = url;
  if (!musicUrl) return;
  musicWanted = true;
  bindUnlock();
  applyMusic();
}
