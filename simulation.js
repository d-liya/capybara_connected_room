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
  const state = test.snapshot();
  return {
    ok: true,
    name: "starter-smoke-test",
    completed: Boolean(state.completed),
    finalState: state,
  };
}
