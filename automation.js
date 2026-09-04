/**
 * E2B simulation integration note: this is the local-only deterministic game
 * driver used by simulation.js to test real input and record a trace/video.
 * It is editable source. The version 1 protocol is the integration boundary:
 * automationBootstrap.js seeds before modules, this module exposes the local
 * window.__capybaraAutomation API, and simulation.js consumes it. It must
 * never become a deployed-game cheat.
 */
import { clearActions, keys, pressAction } from "./input.js";

const params = new URLSearchParams(window.location.search);
const localHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
const enabled = localHost && params.get("automation") === "1";
const realtime = enabled && params.get("realtime") === "1";
const fixedStepMs = 1000 / 60;
const maxTraceEntries = 12_000;
const frameTraceInterval = 30;

let adapter = null;
let nextFrameId = 1;
let now = 0;
let pendingFrames = new Map();
let readyResolve;
let nextTraceIndex = 0;
const trace = [];
const ready = new Promise((resolve) => {
  readyResolve = resolve;
});

if (enabled && !window.__capybaraAutomationSeeded) {
  throw new Error("automationBootstrap.js must seed localhost automation before game modules load.");
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function record(kind, detail = {}) {
  if (trace.length >= maxTraceEntries) trace.shift();
  trace.push({
    index: nextTraceIndex++,
    kind,
    tick: Math.round(now / fixedStepMs),
    time: now / 1000,
    ...clone(detail),
  });
}

function requireEnabled() {
  if (!enabled) throw new Error("Automation is available only on localhost with ?automation=1.");
}

function requireAdapter() {
  requireEnabled();
  if (!adapter) throw new Error("The game has not registered its automation snapshot yet.");
  return adapter;
}

function snapshot() {
  return clone(requireAdapter().snapshot());
}

function setHeld(action, held) {
  requireEnabled();
  if (action !== "left" && action !== "right") {
    throw new Error(`Unsupported held action: ${action}`);
  }
  keys[action] = Boolean(held);
  record("held", { action, held: Boolean(held) });
}

function press(action) {
  requireEnabled();
  pressAction(action);
  record("press", { action });
}

function releaseAll() {
  requireEnabled();
  keys.left = false;
  keys.right = false;
  clearActions();
  record("release_all");
}

async function step(frameCount = 1) {
  requireAdapter();
  const count = Math.max(1, Math.min(realtime ? 3_600 : 60_000, Math.floor(frameCount)));
  for (let frame = 0; frame < count; frame += 1) {
    now += fixedStepMs;
    const callbacks = [...pendingFrames.values()];
    pendingFrames = new Map();
    if (!callbacks.length) {
      throw new Error("The game did not schedule its next animation frame.");
    }
    for (const callback of callbacks) callback(now);
    if (Math.round(now / fixedStepMs) % frameTraceInterval === 0) {
      record("frame", { state: snapshot() });
    }
    if (realtime || frame % 60 === 59) {
      await new Promise((resolve) => setTimeout(resolve, realtime ? fixedStepMs : 0));
    }
  }
  return snapshot();
}

async function until(predicate, options = {}) {
  const maxFrames = Math.max(1, Math.floor(options.maxFrames ?? 3600));
  const label = options.label || "condition";
  for (let frame = 0; frame <= maxFrames; frame += 1) {
    const state = snapshot();
    if (predicate(state)) return state;
    if (frame < maxFrames) await step(1);
  }
  throw new Error(`Timed out after ${maxFrames} frames waiting for ${label}.`);
}

async function holdUntil(action, predicate, options = {}) {
  setHeld(action, true);
  try {
    return await until(predicate, options);
  } finally {
    setHeld(action, false);
  }
}

const api = Object.freeze({
  version: 1,
  enabled,
  fixedStepSeconds: fixedStepMs / 1000,
  ready,
  snapshot,
  setHeld,
  press,
  releaseAll,
  step,
  until,
  holdUntil,
  trace: () => clone(trace),
});

if (enabled) window.__capybaraAutomation = api;

export function automationEnabled() {
  return enabled;
}

export function installAutomation(nextAdapter) {
  if (!enabled) return null;
  if (!nextAdapter || typeof nextAdapter.snapshot !== "function") {
    throw new Error("installAutomation requires a snapshot function.");
  }
  if (adapter) throw new Error("Automation was installed more than once.");

  adapter = nextAdapter;
  window.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    pendingFrames.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => pendingFrames.delete(id);
  record("ready", { state: snapshot() });
  readyResolve(api);
  return api;
}
