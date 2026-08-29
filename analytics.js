(function bootAnalytics() {
  const SDK_SRC = "https://assets.capybara.build/js/game-api-client.js";

  function gameId() {
    return typeof window.gameId === "string" ? window.gameId.trim() : "";
  }

  function loadSdk() {
    if (window.GameServerClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = SDK_SRC;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load GameServerClient"));
      document.head.appendChild(script);
    });
  }

  async function ensureGuest(client) {
    try {
      const session = await client.getSession();
      if (session?.user) return session.user;
    } catch {
      // No session yet.
    }
    const signedIn = await client.signInGuest();
    return signedIn.user;
  }

  async function enableAnalytics() {
    const id = gameId();
    if (!id) return;

    try {
      await loadSdk();
      if (!window.GameServerClient) return;
      const client = new window.GameServerClient();
      await ensureGuest(client);
      client.startPlaytimeTracking(id);
    } catch (error) {
      console.warn("[Game Service] Analytics bootstrap failed", error);
    }
  }

  void enableAnalytics();
})();
