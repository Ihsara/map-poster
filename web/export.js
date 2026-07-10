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

  // Pure: maps the preview's frameBounds (centered max-fit rect of the poster
  // aspect within the live canvas) to a source-canvas sub-rect {sx,sy,sw,sh}
  // so the export samples exactly the framed region — not a blind cover-fit.
  function __computeSourceCrop(srcWH, aspect, ep) {
    const b = ep.frameBounds(srcWH, aspect);
    return { sx: b.x, sy: b.y, sw: b.w, sh: b.h };
  }
  window.__computeSourceCrop = __computeSourceCrop;

  async function exportPoster(state, layouts) {
    const lay = iterLayouts(layouts)[state.layoutId];
    const W = cmToPx(lay.posterWidthCm), H = cmToPx(lay.posterHeightCm);

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // 1) theme ground
    ctx.fillStyle = state.theme.map.land;
    ctx.fillRect(0, 0, W, H);

    // 2) map raster from MapLibre's own canvas, cropped to the same frame the
    // preview shows (WYSIWYG) — not a blind cover-fit.
    const src = window.map.getCanvas();
    const aspect = W / H;
    const crop = __computeSourceCrop({ w: src.width, h: src.height }, aspect, window.exportPreview);
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
    ctx.drawImage(src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, W, H);

    // Project [lng,lat] -> poster px through the same crop rect used above,
    // so density points (bigVenues markers) line up with what was drawn.
    // window.map.project() returns CSS px; the source canvas is
    // devicePixelRatio-scaled, so first convert to source-canvas px, then
    // remap through the crop rect into poster px.
    const rect = src.getBoundingClientRect();
    const scaleX = src.width / rect.width, scaleY = src.height / rect.height;
    const toPoster = (lng, lat) => {
      const p = window.map.project([lng, lat]);      // CSS px
      const sxp = p.x * scaleX, syp = p.y * scaleY;  // source-canvas px
      return [(sxp - crop.sx) / crop.sw * W, (syp - crop.sy) / crop.sh * H];
    };

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

    // Deterministic WYSIWYG title position: when the user has dragged the
    // title chip, state.titlePos is {x,y} and the export honors it exactly —
    // the scorer never runs in that case. In AUTO mode (state.titlePos is
    // null), project window.aoiStore.current.bigVenues (baked, sorted, notable
    // busy-place markers) through the crop into poster px and hand them to
    // window.titlePlacement.pick(...) as the density signal, so the title
    // auto-avoids busy zones instead of always sitting centered-lower. Both
    // the projection (given a fixed map view) and the scorer are pure/
    // deterministic, so a given view + AUTO always yields the same title
    // position. If bigVenues is empty/absent, no in-frame points survive the
    // filter, or the scorer module isn't loaded, fall back to the previous
    // deterministic behavior (undefined -> drawPosterText's centered-lower
    // default) so export never crashes and stays reproducible.
    // Round 5: resolve the title position through the shared resolver so the
    // preview and the export agree exactly. Project the in-frame bigVenues to
    // poster px (unchanged from before), then hand them to window.titleResolve.
    let venuesPx = [];
    if (!state.titlePos && window.aoiStore && window.aoiStore.current) {
      const venues = window.aoiStore.current.bigVenues || [];
      venuesPx = venues
        .filter((v) => v && Array.isArray(v.marker))
        .map((v) => toPoster(v.marker[0], v.marker[1]))
        .filter(([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H);
    }
    const titlePos = (window.titleResolve
      ? window.titleResolve({ titlePos: state.titlePos || null, venuesPx, W, H })
      : (state.titlePos || undefined));

    window.drawPosterText(ctx, {
      width: W, height: H, theme: state.theme,
      center: { lat: state.center[1], lon: state.center[0] },
      city: state.city, country: state.country,
      fonts: state.fonts,
      titleSizeScale: state.titleSizeScale,
      titlePos,
      scrim: true,
      attribution: (window.basemapProvider && window.basemapProvider.attribution &&
                    window.basemapProvider.attribution()) || "© OpenStreetMap contributors",
    });

    // 5) download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      // filename: place_theme_layout_date — mirror of web-src/filename.js + slug.js
      // (đ→d BEFORE NFKD, else "Gia Định" → gia-inh). Keep in sync with those files.
      const _slug = (s) => {
        const m = String(s || "").replace(/đ/g, "d").replace(/Đ/g, "D");
        const a = m.normalize("NFKD").replace(/[̀-ͯ]/g, "");
        return a.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "poster";
      };
      const _date = new Date().toISOString().slice(0, 10); // browser-time OK (not a bake script)
      const _themeId = state.themeId || "theme";
      a.href = url; a.download = `${_slug(state.city)}_${_themeId}_${state.layoutId}_${_date}.png`;
      a.click(); URL.revokeObjectURL(url);
    }, "image/png");
  }
  window.exportPoster = exportPoster;
})();
