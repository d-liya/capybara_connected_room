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
      color: #ead7a8;
      background: rgba(8, 7, 5, 0.86);
      border: 2px solid #b9a273;
      outline: 2px solid #17120b;
      box-shadow: 3px 3px 0 #090806;
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
      color: #ead7a8;
      background: rgba(8, 7, 5, 0.94);
      border: 2px solid #b9a273;
      outline: 2px solid #17120b;
      box-shadow: 3px 3px 0 #090806;
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
      color: #c5ad74;
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
      border: 1px solid #b9a273;
      background: transparent;
      color: #ead7a8;
      font: 700 10px/1 Georgia, serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .audioHudToggle.is-off {
      color: #8a7a55;
      border-color: #6f6244;
    }
    .audioHudRow input[type="range"] {
      display: block;
      width: 100%;
      margin: 0;
      accent-color: #c5ad74;
      cursor: pointer;
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
