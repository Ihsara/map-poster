// WYSIWYG export preview: a crop frame (layout aspect ratio) over the live
// map with the outside dimmed, plus a draggable title chip. Export reuses the
// pure frameBounds() so the baked PNG matches the frame exactly.
(function () {
  function cropAspect(layout) {
    return layout.posterWidthCm / layout.posterHeightCm;
  }
  // Centered max-fit rect of the given aspect (w/h) inside a canvas.
  function frameBounds(canvasWH, aspect) {
    const { w: CW, h: CH } = canvasWH;
    const canvasAspect = CW / CH;
    let w, h;
    if (aspect > canvasAspect) { w = CW; h = CW / aspect; }   // width-limited
    else { h = CH; w = CH * aspect; }                          // height-limited
    return { x: (CW - w) / 2, y: (CH - h) / 2, w, h };
  }

  let els = null, state = {
    aspect: 1, titlePos: { x: 0.5, y: 0.8 }, onMove: null, title: "Title", visible: false,
    dragged: false,
    city: "", country: "", center: [0, 0], theme: null, fonts: {}, titleSizeScale: 1,
    attribution: "© OpenStreetMap contributors", venuesPx: [],
  };

  function ensureEls(container) {
    if (els) return els;
    const frame = document.createElement("div"); frame.className = "xp-frame";
    const chip = document.createElement("div"); chip.className = "xp-title";
    chip.textContent = state.title;
    // Default hidden until Preview is explicitly turned on (setVisible).
    frame.style.display = "none";
    chip.style.display = "none";
    container.appendChild(frame); container.appendChild(chip);
    const cvs = document.createElement("canvas"); cvs.className = "xp-canvas";
    cvs.style.display = "none";
    container.appendChild(cvs);
    // drag the chip within the frame; report normalized coords
    let drag = false;
    chip.addEventListener("pointerdown", (e) => { drag = true; chip.setPointerCapture(e.pointerId); });
    chip.addEventListener("pointerup", () => { drag = false; });
    chip.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const b = frame.getBoundingClientRect();
      const nx = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
      const ny = Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
      state.titlePos = { x: nx, y: ny };
      state.dragged = true;
      layoutEls();
      if (state.onMove) state.onMove(nx, ny);
    });
    els = { frame, chip, canvas: cvs };
    return els;
  }

  function layoutEls() {
    if (!els || !window.map) return;
    const cv = window.map.getCanvas();
    const rect = cv.getBoundingClientRect();
    const b = frameBounds({ w: rect.width, h: rect.height }, state.aspect);
    Object.assign(els.frame.style, { left: b.x+"px", top: b.y+"px", width: b.w+"px", height: b.h+"px" });
    Object.assign(els.chip.style, {
      left: (b.x + state.titlePos.x * b.w) + "px",
      top: (b.y + state.titlePos.y * b.h) + "px",
    });
    renderPreview();
  }

  function renderPreview() {
    if (!els || !els.canvas || !window.map || !state.visible) return;
    if (!window.drawPosterText || !window.applyFades) return;
    const cv = window.map.getCanvas();
    const rect = cv.getBoundingClientRect();
    const b = frameBounds({ w: rect.width, h: rect.height }, state.aspect);
    const dpr = window.devicePixelRatio || 1;
    const cvs = els.canvas;
    cvs.style.display = "block";
    Object.assign(cvs.style, { position: "absolute", left: b.x + "px", top: b.y + "px",
      width: b.w + "px", height: b.h + "px", pointerEvents: "none" });
    cvs.width = Math.max(1, Math.round(b.w * dpr));
    cvs.height = Math.max(1, Math.round(b.h * dpr));
    const ctx = cvs.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, b.w, b.h);
    const land = (state.theme && state.theme.map && state.theme.map.land) || "#f3ecdd";
    window.applyFades(ctx, b.w, b.h, land);
    const titlePos = window.titleResolve
      ? window.titleResolve({ titlePos: state.dragged ? state.titlePos : null, venuesPx: state.venuesPx, W: b.w, H: b.h })
      : (state.dragged ? state.titlePos : undefined);
    window.drawPosterText(ctx, {
      width: b.w, height: b.h, theme: state.theme || {},
      center: { lat: (state.center || [])[1], lon: (state.center || [])[0] },
      city: state.city, country: state.country,
      fonts: state.fonts, titleSizeScale: state.titleSizeScale,
      titlePos, scrim: true, attribution: state.attribution,
    });
    ctx.restore();
  }

  function mount(map, opts) {
    opts = opts || {};
    if (!window.map) window.map = map;
    const container = map.getContainer();
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    ensureEls(container);
    if (opts.aspect) state.aspect = opts.aspect;
    if (opts.titlePos) state.titlePos = opts.titlePos;
    state.onMove = opts.onTitleMove || null;
    layoutEls();
    map.on("move", layoutEls); map.on("resize", layoutEls);
  }

  window.exportPreview = { cropAspect, frameBounds, mount,
    setAspect(a){ state.aspect=a; layoutEls(); },
    setTitlePos(p){ state.titlePos=p; layoutEls(); },
    setTitle(t){
      state.title = t || "Title";
      if (els) els.chip.textContent = state.title;
    },
    setSnapshot(s){
      s = s || {};
      if (s.city != null) state.city = s.city;
      if (s.country != null) state.country = s.country;
      if (s.center) state.center = s.center;
      if (s.theme) state.theme = s.theme;
      if (s.fonts) state.fonts = s.fonts;
      if (typeof s.titleSizeScale === "number") state.titleSizeScale = s.titleSizeScale;
      if (s.attribution) state.attribution = s.attribution;
      if (Array.isArray(s.venuesPx)) state.venuesPx = s.venuesPx;
      layoutEls();
    },
    setVisible(on){
      state.visible = !!on;
      if (els) {
        els.frame.style.display = on ? "block" : "none";
        els.chip.style.display = on ? "block" : "none";
        els.canvas.style.display = on ? "block" : "none";
      }
      if (on) renderPreview();
    } };
})();
