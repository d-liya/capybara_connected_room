const MAP_QUERY_KEY = "map";
const ENTRY_QUERY_KEY = "entry";
const CARRY_KEY = "capybara:connected-room:carry";

function safeMapId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function defineMapRegistry(maps, startMapId) {
  const entries = maps.map((map) => [safeMapId(map.id || map.name), map]);
  const byId = new Map(entries);
  if (!byId.size) throw new Error("A connected-room game needs at least one map.");
  const firstId = entries[0][0];
  const startId = safeMapId(startMapId) || firstId;
  if (!byId.has(startId)) throw new Error(`Unknown start map: ${startId}`);
  return { startMapId: startId, byId };
}

export function resolveActiveMap(registry) {
  const requested = safeMapId(new URLSearchParams(location.search).get(MAP_QUERY_KEY));
  const mapId = registry.byId.has(requested) ? requested : registry.startMapId;
  return { mapId, level: registry.byId.get(mapId) };
}

export function getMapEntry() {
  const params = new URLSearchParams(location.search);
  let carry = {};
  try {
    carry = JSON.parse(sessionStorage.getItem(CARRY_KEY) || "{}");
  } catch {
    carry = {};
  }
  return { entryId: params.get(ENTRY_QUERY_KEY) || null, carry };
}

/** Switch immutable maps with a small reload and explicit carried state. */
export function enterMap(mapId, options = {}) {
  const target = safeMapId(mapId);
  if (!target) throw new Error("enterMap requires a map ID.");
  sessionStorage.setItem(CARRY_KEY, JSON.stringify(options.carry || {}));
  const url = new URL(location.href);
  url.searchParams.set(MAP_QUERY_KEY, target);
  if (options.entryId) url.searchParams.set(ENTRY_QUERY_KEY, options.entryId);
  else url.searchParams.delete(ENTRY_QUERY_KEY);
  location.assign(url);
}
