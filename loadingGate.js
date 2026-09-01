/** Fallback gate length when there are no map assets to probe. */
const DEFAULT_GATE_MS = 2600;
/** Floor so a warm cache / fast CDN still gets a readable brand wipe. */
const MIN_GATE_MS = 2600;
/** Ceiling so a hung image request cannot stall forever. */
const MAX_GATE_MS = 5000;
/** Extra beat after the probe image loads before showing Continue. */
const GATE_DELTA_MS = 400;
/** Shortest finish animation so the bar always visibly reaches 100%. */
const MIN_FINISH_MS = 360;
const LOGO_CROSSFADE_MS = 420;
const OVERLAY_FADE_MS = 550;
const DEV_REVEAL_MS = 420;
const STYLE_ID = "capybara-loading-style";
const FONT_ID = "capybara-geist-pixel";
const IMAGE_URL_RE = /\.(png|jpe?g|gif|bmp|webp|svg)(\?|#|$)/i;
/**
 * One splash per browser tab session — skip when a mobile WebView remounts
 * the page after switching apps (same tab session, navigation type "navigate").
 * Explicit refresh (navigation type "reload") always shows the gate again.
 */
const SESSION_GATE_KEY = "capybara.loadingGate.completed";
const PARENT_START_PARAM = "capybaraStart";
const PARENT_START_MESSAGE = "capybara-game-start";
const PARENT_READY_MESSAGE = "capybara-game-start-ready";

function usesParentStartGate() {
  try {
    return (
      window.parent !== window &&
      new URLSearchParams(window.location.search).get(PARENT_START_PARAM) ===
        "parent"
    );
  } catch {
    return false;
  }
}

function hasCompletedLoadingGateThisSession() {
  try {
    return sessionStorage.getItem(SESSION_GATE_KEY) === "1";
  } catch {
    return false;
  }
}

function markLoadingGateCompletedThisSession() {
  try {
    sessionStorage.setItem(SESSION_GATE_KEY, "1");
  } catch {
    // Private mode / blocked storage — gate may show again; acceptable.
  }
}

function isReloadNavigation() {
  try {
    const entries = performance.getEntriesByType("navigation");
    const nav = entries[0];
    if (nav?.type === "reload") return true;
  } catch {
    // Fall through to legacy API.
  }
  try {
    return (
      typeof performance !== "undefined" &&
      "navigation" in performance &&
      performance.navigation?.type === 1
    );
  } catch {
    return false;
  }
}

/** Skip remount splash, but always show again after an explicit refresh. */
function shouldSkipLoadingGate() {
  if (isReloadNavigation()) return false;
  return hasCompletedLoadingGateThisSession();
}

function isE2bHost(hostname) {
  return (
    hostname === "e2b.dev" ||
    hostname === "e2b.app" ||
    hostname.endsWith(".e2b.dev") ||
    hostname.endsWith(".e2b.app")
  );
}

function isDevMode() {
  return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("gate") === "1") return false;
  const host = window.location.hostname;
  const path = window.location.pathname;
  if (path.includes("/workspace/")) return true;
  if (isE2bHost(host)) return true;
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

function injectGeistPixel() {
  if (document.getElementById(FONT_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Geist+Pixel:wght@400&display=swap";
  document.head.appendChild(link);
}

function injectLoadingStyles() {
  injectGeistPixel();
  document.getElementById(STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .cpy-loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background-color: #0c0c0c;
      color: #ececec;
      font-family: "Geist Pixel", sans-serif;
      font-weight: 400;
      font-synthesis: none;
      opacity: 1;
      transition: opacity ${OVERLAY_FADE_MS}ms ease;
    }

    .cpy-loading-overlay.is-leaving {
      pointer-events: none;
    }

    .cpy-loading-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      opacity: 0;
      animation: cpy-loading-fade-in 1s ease forwards;
    }

    .cpy-loading-logo {
      position: relative;
      display: inline-block;
      opacity: 1;
      transform: scale(1);
      transition:
        opacity ${LOGO_CROSSFADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        transform ${LOGO_CROSSFADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .cpy-loading-logo.is-swapping {
      opacity: 0;
      transform: scale(0.985);
      pointer-events: none;
    }

    .cpy-loading-logo-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      width: max-content;
      max-width: min(92vw, 36em);
      box-sizing: border-box;
    }

    .cpy-loading-mascot {
      display: block;
      width: 48px;
      height: 48px;
      object-fit: contain;
      image-rendering: auto;
      user-select: none;
      pointer-events: none;
    }

    .cpy-loading-logo-dim {
      color: #444;
    }

    .cpy-loading-logo-dim .cpy-loading-mascot {
      filter: grayscale(1) brightness(0.4);
    }

    .cpy-loading-logo-bright {
      color: #fff;
    }

    .cpy-loading-logo.is-title .cpy-loading-mascot {
      display: none;
    }

    .cpy-loading-brand {
      margin: 0;
      font-size: clamp(32px, 8vw, 48px);
      font-weight: 400;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1.15;
      text-align: center;
      white-space: normal;
      overflow-wrap: normal;
      word-break: keep-all;
      hyphens: none;
      max-width: 100%;
    }

    .cpy-loading-logo.is-title .cpy-loading-logo-content {
      width: min(92vw, 56rem);
      max-width: min(92vw, 56rem);
    }

    .cpy-loading-logo.is-title .cpy-loading-brand {
      font-size: clamp(32px, 4.4vw, 64px);
      text-wrap: balance;
    }

    .cpy-loading-subtitle {
      margin: 0;
      font-size: clamp(12px, 2.6vw, 14px);
      letter-spacing: 0.34em;
      text-indent: 0.34em;
      text-transform: uppercase;
      line-height: 1;
      text-align: center;
    }

    .cpy-loading-subtitle:empty {
      display: none;
    }

    .cpy-loading-logo.is-title {
      cursor: pointer;
    }

    .cpy-loading-logo.is-title .cpy-loading-logo-dim {
      visibility: hidden;
    }

    .cpy-loading-logo.is-title .cpy-loading-reveal-mask {
      width: 100% !important;
      transition: none;
    }

    .cpy-loading-logo.is-title .cpy-loading-logo-bright {
      opacity: 1;
      transition: opacity 180ms ease;
    }

    .cpy-loading-logo.is-title:hover .cpy-loading-logo-bright,
    .cpy-loading-logo.is-title:focus-visible .cpy-loading-logo-bright {
      opacity: 0.7;
    }

    .cpy-loading-logo.is-title:focus-visible {
      outline: none;
    }

    .cpy-loading-logo.is-title:active .cpy-loading-logo-bright {
      opacity: 0.55;
    }

    .cpy-loading-reveal-mask {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 0%;
      overflow: hidden;
      transition: width ${MAX_GATE_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .cpy-loading-status {
      position: absolute;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      font-family: "Geist Pixel", sans-serif;
      font-size: 12px;
      font-weight: 400;
      font-synthesis: none;
      letter-spacing: 0.02em;
      color: #fff;
      opacity: 0;
      animation: cpy-loading-fade-in 1s ease 0.5s forwards;
    }

    .cpy-loading-status.is-hidden {
      opacity: 0 !important;
      animation: none;
      pointer-events: none;
    }

    .cpy-loading-continue {
      position: absolute;
      bottom: 48px;
      left: 50%;
      transform: translateX(-50%);
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      color: #fff;
      font-family: "Geist Pixel", sans-serif;
      font-size: clamp(14px, 3vw, 16px);
      font-weight: 400;
      font-synthesis: none;
      letter-spacing: 0.28em;
      text-indent: 0.28em;
      text-transform: uppercase;
      line-height: 1;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity ${LOGO_CROSSFADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .cpy-loading-continue.is-visible {
      opacity: 1;
      pointer-events: auto;
    }

    .cpy-loading-continue:hover,
    .cpy-loading-continue:focus-visible {
      opacity: 0.7;
      outline: none;
    }

    .cpy-loading-continue:active {
      opacity: 0.55;
    }

    .cpy-loading-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background-color: transparent;
      opacity: 1;
      transition: opacity 300ms ease;
    }

    .cpy-loading-progress.is-complete {
      opacity: 0;
    }

    .cpy-loading-progress-line {
      height: 100%;
      width: 0%;
      background-color: #fff;
      transition: width ${MAX_GATE_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes cpy-loading-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

const MASCOT_HEAD_URL =
  "https://www.capybara.build/_next/image?url=%2Fmascot-capybara-head.png&w=48&q=75";

function createTitleBlock(toneClass, brandText, subtitleText) {
  const root = document.createElement("div");
  root.className = `cpy-loading-logo-content ${toneClass}`;

  const mascot = document.createElement("img");
  mascot.className = "cpy-loading-mascot";
  mascot.src = MASCOT_HEAD_URL;
  mascot.alt = "";
  mascot.width = 48;
  mascot.height = 48;
  mascot.decoding = "async";
  mascot.draggable = false;

  const brand = document.createElement("h1");
  brand.className = "cpy-loading-brand";
  brand.textContent = brandText;

  const subtitle = document.createElement("p");
  subtitle.className = "cpy-loading-subtitle";
  subtitle.textContent = subtitleText;

  root.appendChild(mascot);
  root.appendChild(brand);
  root.appendChild(subtitle);
  return { root, brand, subtitle };
}

function getGameTitle() {
  const fromWindow =
    typeof window.game_title === "string" ? window.game_title.trim() : "";
  if (fromWindow) return fromWindow;
  const fromDocument = document.title?.trim();
  if (fromDocument) return fromDocument;
  return "Game";
}

function createProductionOverlay() {
  injectLoadingStyles();

  const overlay = document.createElement("div");
  overlay.className = "cpy-loading-overlay";

  const center = document.createElement("div");
  center.className = "cpy-loading-center";

  const logo = document.createElement("div");
  logo.className = "cpy-loading-logo";

  const dim = createTitleBlock("cpy-loading-logo-dim", "Capybraar", "Game AI");
  const revealMask = document.createElement("div");
  revealMask.className = "cpy-loading-reveal-mask";
  const bright = createTitleBlock(
    "cpy-loading-logo-bright",
    "Capybraar",
    "Game AI",
  );

  revealMask.appendChild(bright.root);
  logo.appendChild(dim.root);
  logo.appendChild(revealMask);
  center.appendChild(logo);

  const status = document.createElement("div");
  status.className = "cpy-loading-status";
  status.textContent = "www.capybara.build";

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "cpy-loading-continue";
  continueBtn.textContent = "Continue";
  continueBtn.setAttribute("aria-label", "Continue");

  const progress = document.createElement("div");
  progress.className = "cpy-loading-progress";
  const progressLine = document.createElement("div");
  progressLine.className = "cpy-loading-progress-line";
  progress.appendChild(progressLine);

  overlay.appendChild(center);
  overlay.appendChild(status);
  overlay.appendChild(continueBtn);
  overlay.appendChild(progress);

  return {
    overlay,
    status,
    logo,
    dim,
    bright,
    revealMask,
    progress,
    progressLine,
    continueBtn,
  };
}

function setLogoCopy(dim, bright, brandText, subtitleText) {
  const brand = String(brandText).replace(/-/g, "\u2011");
  dim.brand.textContent = brand;
  bright.brand.textContent = brand;
  dim.subtitle.textContent = subtitleText;
  bright.subtitle.textContent = subtitleText;
}

function waitForTransitionEnd(element, propertyName, fallbackMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      element.removeEventListener("transitionend", onEnd);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === element && event.propertyName === propertyName) {
        finish();
      }
    };
    element.addEventListener("transitionend", onEnd);
    setTimeout(finish, fallbackMs + 40);
  });
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function looksLikeMapData(value) {
  return (
    Array.isArray(value.walkableBoxes) ||
    Array.isArray(value.masks) ||
    Array.isArray(value.sprites) ||
    Array.isArray(value.mapOverlays) ||
    Array.isArray(value.characterPlacements) ||
    (typeof value.url === "string" && typeof value.name === "string")
  );
}

function findFirstMapImageUrl(dataFiles) {
  for (const data of dataFiles) {
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    if (!looksLikeMapData(data)) continue;
    const url = data.url;
    if (typeof url !== "string" || url.length === 0) continue;
    if (
      IMAGE_URL_RE.test(url) ||
      url.startsWith("http") ||
      url.startsWith("/")
    ) {
      return url;
    }
  }
  return null;
}

function loadImageProbe(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
    if (img.complete && img.naturalWidth > 0) resolve();
  });
}

async function resolveGateDurationMs(dataFiles) {
  if (!Array.isArray(dataFiles) || dataFiles.length === 0) {
    return DEFAULT_GATE_MS;
  }
  const url = findFirstMapImageUrl(dataFiles);
  if (!url) return DEFAULT_GATE_MS;

  const started = performance.now();
  try {
    await loadImageProbe(url);
  } catch {
    return DEFAULT_GATE_MS;
  }
  return clamp(
    performance.now() - started + GATE_DELTA_MS,
    MIN_GATE_MS,
    MAX_GATE_MS,
  );
}

export const LOADING_GATE_CONTINUE_EVENT = "capybara:loading-gate-continue";

export function createCoreLoadingGate(canvas, options = {}) {
  const parentStartGate = usesParentStartGate();
  // A host-controlled embed must never inherit the standalone tab's completed
  // session flag; the parent Play button owns each start explicitly.
  const skipSplash = !parentStartGate && shouldSkipLoadingGate();

  if (isDevMode()) {
    if (skipSplash) {
      return {
        onContinue: () => () => undefined,
        waitForCompletion: () => Promise.resolve(),
        teardown: () => undefined,
      };
    }

    document.body.style.opacity = "0";
    document.body.style.transition = `opacity ${DEV_REVEAL_MS}ms ease`;

    return {
      onContinue: () => () => undefined,
      waitForCompletion: () => Promise.resolve(),
      teardown: () => {
        markLoadingGateCompletedThisSession();
        requestAnimationFrame(() => {
          document.body.style.opacity = "1";
        });
      },
    };
  }

  if (skipSplash) {
    return {
      onContinue: (listener) => {
        listener({ userActivated: false });
        return () => undefined;
      },
      waitForCompletion: () => Promise.resolve(),
      teardown: () => undefined,
    };
  }

  if (canvas) canvas.style.visibility = "hidden";
  document.querySelectorAll(".cpy-loading-overlay").forEach((el) => el.remove());

  const {
    overlay,
    status,
    logo,
    dim,
    bright,
    revealMask,
    progress,
    progressLine,
    continueBtn,
  } = createProductionOverlay();
  document.body.appendChild(overlay);

  let isResolved = false;
  let hasEmittedContinue = false;
  let continueReady = false;
  let parentStartRequested = false;
  let resolvePromise = () => {};
  const completionPromise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  const continueListeners = new Set();

  const emitContinueIfNeeded = (detail) => {
    if (hasEmittedContinue) return;
    hasEmittedContinue = true;
    if (detail.userActivated) markLoadingGateCompletedThisSession();
    for (const listener of continueListeners) listener(detail);
    window.dispatchEvent(
      new CustomEvent(LOADING_GATE_CONTINUE_EVENT, { detail }),
    );
  };

  const resolveIfNeeded = () => {
    if (isResolved) return;
    isResolved = true;
    resolvePromise();
  };

  const continueGame = (detail) => {
    if (!continueReady) {
      if (detail.source === "parent") parentStartRequested = true;
      return;
    }
    emitContinueIfNeeded({ userActivated: true, source: detail.source });
    resolveIfNeeded();
  };

  const onParentMessage = (event) => {
    if (!parentStartGate || event.source !== window.parent) return;
    if (event.data?.type !== PARENT_START_MESSAGE) return;
    continueGame({ source: "parent" });
  };

  if (parentStartGate) {
    window.addEventListener("message", onParentMessage);
    window.parent.postMessage({ type: PARENT_READY_MESSAGE }, "*");
  }

  const enableContinue = () => {
    continueReady = true;
    if (parentStartGate) {
      if (parentStartRequested) continueGame({ source: "parent" });
      return;
    }

    const onContinue = () => {
      continueGame({ source: "template" });
    };

    logo.setAttribute("role", "button");
    logo.setAttribute("tabindex", "0");
    logo.setAttribute("aria-label", "Continue");

    const onKeyDown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onContinue();
      }
    };

    for (const target of [overlay, logo, continueBtn]) {
      target.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        onContinue();
      });
      target.addEventListener("click", onContinue);
    }
    logo.addEventListener("keydown", onKeyDown);
    continueBtn.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onKeyDown);
  };

  const showTitleAndContinue = async () => {
    progress.classList.add("is-complete");
    status.classList.add("is-hidden");
    enableContinue();

    logo.classList.add("is-swapping");
    await waitForTransitionEnd(logo, "opacity", LOGO_CROSSFADE_MS);

    setLogoCopy(dim, bright, getGameTitle(), "");
    revealMask.style.transition = "none";
    revealMask.style.width = "100%";
    logo.classList.add("is-title");

    await nextFrame();
    logo.classList.remove("is-swapping");
    if (!parentStartGate) continueBtn.classList.add("is-visible");
  };

  setTimeout(() => {
    progressLine.style.width = "100%";
    revealMask.style.width = "100%";
  }, 50);

  const dataFiles = Array.isArray(options.dataFiles) ? options.dataFiles : [];
  const gateStarted = performance.now();

  void (async () => {
    const targetMs = await resolveGateDurationMs(dataFiles);
    const elapsed = performance.now() - gateStarted;
    const remaining = Math.max(0, targetMs - elapsed);
    const finishMs = Math.max(MIN_FINISH_MS, remaining);
    const wipeEasing = "cubic-bezier(0.4, 0, 0.2, 1)";
    for (const el of [progressLine, revealMask]) {
      const currentWidth = getComputedStyle(el).width;
      el.style.transition = "none";
      el.style.width = currentWidth;
      void el.offsetWidth;
      el.style.transition = `width ${finishMs}ms ${wipeEasing}`;
      el.style.width = "100%";
    }
    await waitForTransitionEnd(progressLine, "width", finishMs);
    await showTitleAndContinue();
  })();

  return {
    onContinue: (listener) => {
      continueListeners.add(listener);
      return () => continueListeners.delete(listener);
    },
    waitForCompletion: () => completionPromise,
    teardown: () => {
      window.removeEventListener("message", onParentMessage);
      resolveIfNeeded();
      if (canvas) canvas.style.visibility = "visible";
      overlay.classList.add("is-leaving");
      overlay.style.pointerEvents = "none";
      requestAnimationFrame(() => {
        overlay.style.opacity = "0";
      });
      setTimeout(() => overlay.remove(), OVERLAY_FADE_MS + 20);
    },
  };
}
