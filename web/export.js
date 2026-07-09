// High-res PNG exporter (Terraink furniture port):
//   ground → map raster (cover-fit) → 25/25 land fade → centered text block.
// No legend, compass, scale bar, hero label or declash — the poster is
// deliberately minimal.
//
// AOI fade + category building-light are NOT composited here on a separate
// canvas: they are MapLibre layers on the LIVE window.map (see boundary_mask.js
// applyBoundaryFade + category_layer.js), so the map raster captured below at
// step (2) already carries them at export resolution. Do NOT reintroduce a
// separate MapLibre "export map" to re-add these layers — the live-canvas
// drawImage is the single capture path.
(function () {
  const CM_PER_IN = 2.54, DPI = 300;
  const cmToPx = (cm) => Math.round(cm / CM_PER_IN * DPI);

  // Flatten the v3 categories[] structure to {layoutId: layout} — mirrors
  // src/validate.iter_layouts so we can look a layout up by id.
  function iterLayouts(layouts) {
    const flat = {};
    for (const cat of (layouts.categories || [])) {
      for (const lay of (cat.layouts || [])) flat[lay.id] = lay;
    }
    return flat;
  }

  async function exportPoster(state, layouts) {
    const lay = iterLayouts(layouts)[state.layoutId];
    const W = cmToPx(lay.posterWidthCm), H = cmToPx(lay.posterHeightCm);

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // 1) theme ground
    ctx.fillStyle = state.theme.map.land;
    ctx.fillRect(0, 0, W, H);

    // 2) map raster from MapLibre's own canvas (cover-fit into W×H)
    const src = window.map.getCanvas();
    const sr = src.width / src.height, dr = W / H;
    let dw = W, dh = H, dx = 0, dy = 0;
    if (sr > dr) { dh = H; dw = H * sr; dx = (W - dw) / 2; }
    else { dw = W; dh = W / sr; dy = (H - dh) / 2; }
    // ensure the WebGL frame is current — but never hang forever if tiles never
    // settle (e.g. a bad/absent key): race "idle" against a 4s timeout so export
    // always completes with whatever frame is current.
    window.map.triggerRepaint();
    await new Promise(r => {
      let done = false;
      const finish = () => { if (!done) { done = true; r(); } };
      window.map.once("idle", finish);
      setTimeout(finish, 4000);
    });
    ctx.drawImage(src, dx, dy, dw, dh);

    // 3) 25/25 land fade top + bottom
    window.applyFades(ctx, W, H, state.theme.map.land);

    // 4) centered city / rule / country / coordinates text block
    // Task 7 sanctioned font-routing touch-point (1 of 2 — see
    // web/typography.js for the other): pass state.fonts (resolved by
    // renderer.js#buildSnapshot from the store's fontPairingId/advancedFont)
    // and state.titleSizeScale through untouched. drawPosterText falls back
    // to its previous hardcoded literals/scale when these are absent, so
    // callers that don't pass them (e.g. any older snapshot shape) still
    // render exactly as before.
    //
    // Best-effort font warm-up: nudges the browser to have each face ready
    // before the canvas draws it. Belt-and-braces only — the actual fix for
    // a real Chromium canvas bug found during Task 7's VN gate (a mismatched
    // generic CSS fallback keyword in the font shorthand can make custom
    // @font-face text silently render as the generic instead, even once
    // document.fonts reports it "loaded") lives in typography.js, which now
    // uses fonts.genericDisplay instead of a hardcoded "serif". Kept here
    // too since it is cheap and can only help.
    if (window.document && document.fonts && state.fonts) {
      const f = state.fonts;
      await Promise.all([
        document.fonts.load(`700 54px "${f.display}"`),
        document.fonts.load(`400 22px "${f.body}"`),
        document.fonts.load(`400 18px "${f.mono}"`),
      ]).catch(() => {});
    }

    window.drawPosterText(ctx, {
      width: W, height: H, theme: state.theme,
      center: { lat: state.center[1], lon: state.center[0] },
      city: state.city, country: state.country,
      fonts: state.fonts,
      titleSizeScale: state.titleSizeScale,
      attribution: (window.basemapProvider && window.basemapProvider.attribution &&
                    window.basemapProvider.attribution()) || "© OpenStreetMap contributors",
    });

    // 5) download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `map-poster-${state.layoutId}.png`;
      a.click(); URL.revokeObjectURL(url);
    }, "image/png");
  }
  window.exportPoster = exportPoster;
})();
