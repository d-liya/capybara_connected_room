function sameValue(actual, expected) {
  if (expected == null) return Boolean(actual);
  return actual === expected;
}

function legacyRequirements(requirement) {
  if (!requirement || Array.isArray(requirement)) return requirement || [];
  return [
    ...(requirement.defeat || []).map((targetId) => ({
      type: "defeat",
      targetId,
      value: true,
    })),
    ...(requirement.collect || []).map((targetId) => ({
      type: "collect",
      targetId,
      value: true,
    })),
    ...(requirement.state || []),
  ];
}

export function createMechanics(level, { actors = [], collectibles = [] } = {}) {
  const initialState = new Map(Object.entries(level.initialState || {}));
  const state = new Map(initialState);
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const collectibleById = new Map(
    collectibles.map((item) => [item.id, item]),
  );

  function get(rule) {
    const type = String(rule?.type || "state").toLowerCase();
    const targetId = rule?.targetId;
    if (type === "defeat" || type === "kill") {
      return Boolean(actorById.get(targetId)?.dead);
    }
    if (type === "collect" || type === "pickup") {
      return Boolean(collectibleById.get(targetId)?.collected);
    }
    return state.get(targetId || type);
  }

  function conditionMet(rule) {
    return sameValue(get(rule), rule?.value);
  }

  function requirementsMet(requirement) {
    return legacyRequirements(requirement).every(conditionMet);
  }

  function applyEffect(effect) {
    const type = String(effect?.type || "state").toLowerCase();
    const targetId = effect?.targetId || type;
    const value = effect?.value ?? true;
    if (type === "defeat" || type === "kill") {
      const actor = actorById.get(targetId);
      if (actor) actor.dead = Boolean(value);
      return;
    }
    if (type === "collect" || type === "pickup") {
      const item = collectibleById.get(targetId);
      if (item) item.collected = Boolean(value);
      return;
    }
    state.set(targetId, value);
  }

  function applyEffects(effects = []) {
    effects.forEach(applyEffect);
  }

  function resetFloor(floor) {
    for (const interaction of level.interactions || []) {
      if (interaction.floor !== floor || /persist/i.test(interaction.reset || "")) {
        continue;
      }
      state.delete(interaction.id);
      for (const effect of interaction.effects || []) {
        const type = String(effect.type || "state").toLowerCase();
        if (["defeat", "kill", "collect", "pickup"].includes(type)) continue;
        const id = effect.targetId || type;
        if (initialState.has(id)) state.set(id, initialState.get(id));
        else state.delete(id);
      }
    }
  }

  return {
    state,
    get,
    set: (id, value = true) => state.set(id, value),
    conditionMet,
    requirementsMet,
    applyEffects,
    resetFloor,
  };
}
