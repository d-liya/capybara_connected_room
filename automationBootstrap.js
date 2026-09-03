/**
 * E2B automation bootstrap note: this classic script runs before any game
 * module when localhost automation is enabled. It seeds randomness early so
 * module-level setup is deterministic. It is editable source; if replaced,
 * retain an equivalent pre-module seed path for the version 1 E2B protocol.
 */
(function installAutomationSeed() {
  const params = new URLSearchParams(window.location.search);
  const localHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (!localHost || params.get("automation") !== "1") return;

  let randomState = (Number(params.get("seed")) || 1) >>> 0;
  Math.random = () => {
    randomState = (randomState + 0x6d2b79f5) >>> 0;
    let value = randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  Object.defineProperty(window, "__capybaraAutomationSeeded", {
    value: true,
    configurable: false,
    writable: false,
  });
})();
