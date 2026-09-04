/**
 * E2B simulation note: this is a game-specific playthrough test, executed in
 * localhost automation mode against the real game loop. It is editable source.
 * Keep it aligned with version 1 of the E2B input protocol so it can prove
 * normal completion without directly forcing internal game state.
 */
export async function runSimulation(test) {
  await test.ready;
  test.releaseAll();
  await test.step(1);
  let state = test.snapshot();
  if (state.phase === "intro") {
    state = await test.until(
      (next) => next.phase !== "intro",
      { maxFrames: 1800, label: "intro completes and releases gameplay" },
    );
  }
  if (state.introOverlayPresent) {
    throw new Error("Intro overlay remained mounted after the intro phase.");
  }
  if (state.camera?.scripted) {
    throw new Error("Camera remained scripted after the intro phase.");
  }
  return {
    ok: true,
    name: "starter-smoke-test",
    completed: Boolean(state.completed),
    finalState: state,
  };
}
