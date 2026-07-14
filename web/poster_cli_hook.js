// Headless export hook for the Python CLI.
//
// This intentionally drives the real browser page: it mutates the same
// posterStore signals the UI uses, waits for MapLibre/fonts, then calls the
// page-level export command wired to the same renderer adapter as the Export button.
(function () {
  function waitFor(predicate, label, timeoutMs) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        try {
          const value = predicate();
          if (value) return resolve(value);
        } catch (err) {
          return reject(err);
        }
        if (Date.now() - started > timeoutMs) {
          return reject(new Error(`Timed out waiting for ${label}`));
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  // Wait for a map that is idle *now*.
  //
  // ⚠ `settled` is deliberately NOT used after a data change — see nextIdle().
  function onceIdle(timeoutMs) {
    return new Promise((resolve, reject) => {
      const map = window.map;
      if (!map) return reject(new Error("MapLibre map is not initialized"));
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      let timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error("Timed out waiting for MapLibre idle"));
      }, timeoutMs);
      if (map.loaded && map.loaded() && map.areTilesLoaded && map.areTilesLoaded()) {
        finish();
      } else {
        map.once("idle", finish);
        map.triggerRepaint();
      }
    });
  }

  // Wait for the NEXT idle event — never the instantaneous "are you idle right
  // now?" state.
  //
  // THE RACE THIS FIXES (it shipped a wrong poster 3 runs out of 4): selecting an
  // AOI is ASYNC — aoi.js does `current = await aoiPayloadCache.get(id)` and only
  // THEN rebuilds the map's layers from that payload. In the window between the
  // store dispatch and the layer rebuild, the map still reports loaded() &&
  // areTilesLoaded() — it is idle because it has not STARTED the new work yet.
  // onceIdle()'s fast path therefore resolved immediately and the export captured
  // the PREVIOUS AOI's frame: a poster of Phường Gia Định titled "Bình Thạnh".
  //
  // The snapshot was never wrong (buildSnapshot always carried the right name);
  // only the CANVAS was stale, which is why every unit test stayed green.
  function nextIdle(timeoutMs) {
    return new Promise((resolve, reject) => {
      const map = window.map;
      if (!map) return reject(new Error("MapLibre map is not initialized"));
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error("Timed out waiting for the next MapLibre idle"));
      }, timeoutMs);
      map.once("idle", finish);
      map.triggerRepaint();
    });
  }

  async function fontsReady() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  }

  async function configure(opts) {
    const store = await waitFor(() => window.posterStore, "posterStore", 15000);
    const manifest = await waitFor(
      () => window.aoiStore && window.aoiStore.manifest && window.aoiStore.manifest.length && window.aoiStore.manifest,
      "AOI manifest",
      15000
    );
    const entry = manifest.find((m) => m.id === opts.aoiId);
    if (!entry) throw new Error(`Unknown AOI id: ${opts.aoiId}`);

    // ⚠ WAIT FOR THE APP'S OWN BOOT setAoi TO HAVE ALREADY FIRED.
    //
    // THE RACE (it mislabeled 3 posters in 4). main.jsx boots with syncBootAoi(),
    // a `setTimeout(..., 50)` POLLING LOOP that retries until the AOI payload is
    // ready and then dispatches its own setAoi for the DEFAULT AOI (Bình Thạnh).
    // If the CLI dispatches first, that boot dispatch lands AFTER us and resets
    // the title. Traced, and it is exactly the double-dispatch:
    //
    //   good: [setAoi, setPanSuggest, aoiLoaded]                -> "Phường Gia Định"
    //   bad:  [setAoi, setAoi, setPanSuggest, aoiLoaded, ...]   -> "Bình Thạnh"
    //                   ^^^^^^ syncBootAoi, landing late
    //
    // The MAP was always correct (it reflects the last load — ours). Only the
    // TITLE got clobbered: a poster of one ward wearing another ward's name.
    //
    // Waiting on `aoiStore.current` is NOT enough — that is set by the payload
    // load, which happens BEFORE syncBootAoi's next 50ms tick. The signal that
    // syncBootAoi has actually run is the store's own aoiId being populated,
    // because that is the first thing it writes.
    await waitFor(
      () => window.posterStore.state.aoiId.value,
      "the app's boot setAoi (syncBootAoi)",
      opts.timeoutMs || 30000
    );

    if (opts.themeId) store.dispatch({ type: "setTheme", id: opts.themeId });
    if (opts.layoutId) store.dispatch({ type: "setLayout", id: opts.layoutId });
    store.dispatch({
      type: "setAoi",
      id: entry.id,
      name: entry.name,
      districtName: entry.districtName,
      provinceName: entry.provinceName,
    });

    // aoiStore.current flipping to the new id means the PAYLOAD has been fetched
    // (aoi.js: `current = await aoiPayloadCache.get(id)`). It does NOT mean the
    // map has been redrawn from it — the layer rebuild happens after, async.
    await waitFor(
      () => window.aoiStore && window.aoiStore.current && window.aoiStore.current.id === entry.id,
      `AOI ${entry.id}`,
      opts.timeoutMs || 30000
    );

    // So: wait for the NEXT idle, not the current one. Asking "is the map idle?"
    // here answers YES — it hasn't begun redrawing for the new AOI yet — and the
    // export then captures the PREVIOUS AOI's frame. Measured: 3 of 4 identical
    // runs produced a Phường Gia Định poster titled "Bình Thạnh".
    await nextIdle(opts.timeoutMs || 30000);

    // Fonts must be swapped in before the title is drawn, or the poster silently
    // falls back to a system face — and the title IS the design.
    await fontsReady();

    // A final settle: fonts swapping in (and any layer work the first idle raced)
    // can dirty the canvas again. onceIdle is right HERE — by now the map has
    // genuinely done the new AOI's work, so "already idle" is the truth.
    await onceIdle(opts.timeoutMs || 30000);
  }

  async function exportPng(opts) {
    await configure(opts || {});
    if (!window.posterExport) throw new Error("posterExport is not available");
    await window.posterExport();
  }

  window.posterCli = { configure, exportPng, waitForIdle: onceIdle, fontsReady };
})();
