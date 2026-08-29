import {
  AUDIO_CHANNELS,
  getAudioSettings,
  onAudioSettingsChange,
  setAudioChannel,
} from "./audio.js";

const STYLE_ID = "capybara-audio-hud-style";
const SPEAKER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5z" fill="currentColor"/><path d="M15.2 8.8a4.8 4.8 0 0 1 0 6.4M17.8 6.2a8.4 8.4 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    body.has-audio-hud #objective {
      margin-right: 46px;
    }
    body.is-intro #audioHud {
      opacity: 0;
      pointer-events: none;
    }
    #audioHud {
      position: absolute;
      top: max(8px, var(--safe-top));
      right: max(10px, var(--safe-right));
      z-index: 24;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      pointer-events: none;
    }
    #audioHudToggle,
    #audioHudPanel {
      pointer-events: auto;
      touch-action: manipulation;
    }
    #audioHudToggle {
      appearance: none;
      width: 36px;
      height: 36px;
      margin: 0;
      padding: 0;
      display: grid;
      place-items: center;
      color: #fff;
      background: rgba(21, 13, 12, 0.58);
      border: 0;
      outline: none;
      border-radius: 50%;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.13), 0 8px 24px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(16px) saturate(1.2);
      -webkit-backdrop-filter: blur(16px) saturate(1.2);
      cursor: pointer;
    }
    #audioHudToggle svg {
      width: 18px;
      height: 18px;
    }
    #audioHudToggle.is-muted {
      color: #8a7a55;
    }
    #audioHudPanel {
      width: min(230px, calc(100vw - 24px));
      padding: 10px 12px 12px;
      color: #fff;
      background: rgba(21, 13, 12, 0.78);
      border: 0;
      outline: none;
      border-radius: 14px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    #audioHudPanel[hidden] {
      display: none;
    }
    #audioHudPanel .audioHudTitle {
      display: block;
      margin-bottom: 8px;
      font: 700 12px/1 Georgia, serif;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #fff;
    }
    .audioHudRow + .audioHudRow {
      margin-top: 10px;
    }
    .audioHudMeta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .audioHudMeta span {
      font: 700 13px/1 Georgia, serif;
    }
    .audioHudToggle {
      appearance: none;
      margin: 0;
      padding: 3px 8px;
      min-width: 42px;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      font: 700 10px/1 Georgia, serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .audioHudToggle.is-off {
      color: #8a7a55;
      background: rgba(0, 0, 0, 0.16);
    }
    .audioHudRow input[type="range"] {
      appearance: none;
      -webkit-appearance: none;
      display: block;
      width: 100%;
      height: 24px;
      margin: 0;
      background: transparent;
      touch-action: none;
      cursor: pointer;
    }
    .audioHudRow input[type="range"]::-webkit-slider-runnable-track {
      height: 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.28);
    }
    .audioHudRow input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      margin-top: -7.5px;
      border: 0;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 7px rgba(0, 0, 0, 0.36);
    }
    .audioHudRow input[type="range"]::-moz-range-track {
      height: 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.28);
    }
    .audioHudRow input[type="range"]::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border: 0;
      border-radius: 50%;
      background: #fff;
    }
    .audioHudRow.is-off input[type="range"] {
      opacity: 0.45;
    }
    @media (max-width: 700px) {
      body.has-audio-hud #objective {
        margin-right: 40px;
      }
      #audioHudToggle {
        width: 32px;
        height: 32px;
      }
    }
  `;
  document.head.appendChild(style);
}

function allMuted(settings) {
  return AUDIO_CHANNELS.every((channel) => !settings[channel.id].on);
}

export function mountAudioHud(root = document.getElementById("stage")) {
  if (!root || document.getElementById("audioHud")) return;
  injectStyles();
  document.body.classList.add("has-audio-hud");

  const wrap = document.createElement("div");
  wrap.id = "audioHud";
  wrap.innerHTML = `
    <button type="button" id="audioHudToggle" aria-label="Audio settings" aria-expanded="false" aria-controls="audioHudPanel" title="Audio (M)">
      ${SPEAKER}
    </button>
    <div id="audioHudPanel" hidden role="dialog" aria-label="Audio settings">
      <strong class="audioHudTitle">Audio</strong>
      ${AUDIO_CHANNELS.map(
        (channel) => `
        <div class="audioHudRow" data-channel="${channel.id}">
          <div class="audioHudMeta">
            <span>${channel.label}</span>
            <button type="button" class="audioHudToggle" data-channel="${channel.id}" aria-pressed="true">On</button>
          </div>
          <input type="range" min="0" max="100" step="1" data-channel="${channel.id}" aria-label="${channel.label} volume" />
        </div>`,
      ).join("")}
    </div>
  `;
  root.appendChild(wrap);

  const button = wrap.querySelector("#audioHudToggle");
  const panel = wrap.querySelector("#audioHudPanel");
  let open = false;

  function setOpen(next) {
    open = next;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function sync(settings = getAudioSettings()) {
    button.classList.toggle("is-muted", allMuted(settings));
    for (const channel of AUDIO_CHANNELS) {
      const bus = settings[channel.id];
      const row = panel.querySelector(`.audioHudRow[data-channel="${channel.id}"]`);
      const toggle = row.querySelector(".audioHudToggle");
      const slider = row.querySelector("input[type=range]");
      row.classList.toggle("is-off", !bus.on);
      toggle.textContent = bus.on ? "On" : "Off";
      toggle.classList.toggle("is-off", !bus.on);
      toggle.setAttribute("aria-pressed", bus.on ? "true" : "false");
      slider.value = String(Math.round(bus.volume * 100));
    }
  }

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!open);
  });

  panel.addEventListener("pointerdown", (event) => event.stopPropagation());
  panel.addEventListener("click", (event) => {
    const toggle = event.target.closest(".audioHudToggle");
    if (!toggle) return;
    const channel = toggle.dataset.channel;
    const on = getAudioSettings()[channel].on;
    setAudioChannel(channel, { on: !on });
  });
  panel.addEventListener("input", (event) => {
    const slider = event.target.closest("input[type=range]");
    if (!slider) return;
    setAudioChannel(slider.dataset.channel, {
      volume: Number(slider.value) / 100,
    });
  });

  let activeSliderPointer = null;
  const setSliderFromPointer = (slider, clientX) => {
    const rect = slider.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    slider.value = String(Math.round(ratio * 100));
    setAudioChannel(slider.dataset.channel, { volume: ratio });
  };
  panel.addEventListener("pointerdown", (event) => {
    const slider = event.target.closest("input[type=range]");
    if (!slider) return;
    event.preventDefault();
    event.stopPropagation();
    activeSliderPointer = event.pointerId;
    slider.setPointerCapture?.(event.pointerId);
    setSliderFromPointer(slider, event.clientX);
  });
  panel.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activeSliderPointer) return;
    const slider = event.target.closest("input[type=range]");
    if (!slider) return;
    event.preventDefault();
    setSliderFromPointer(slider, event.clientX);
  });
  const releaseSlider = (event) => {
    if (event.pointerId === activeSliderPointer) activeSliderPointer = null;
  };
  panel.addEventListener("pointerup", releaseSlider);
  panel.addEventListener("pointercancel", releaseSlider);

  root.addEventListener(
    "pointerdown",
    (event) => {
      if (!open || wrap.contains(event.target)) return;
      event.stopPropagation();
      setOpen(false);
    },
    true,
  );

  window.addEventListener("keydown", (event) => {
    if (document.body.classList.contains("is-intro")) return;
    if (event.code === "KeyM" && !event.repeat) {
      event.preventDefault();
      setOpen(!open);
      return;
    }
    if (event.code === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  });

  sync();
  onAudioSettingsChange(sync);
}
