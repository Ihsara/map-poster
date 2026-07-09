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

  let els = null, state = { aspect: 1, titlePos: { x: 0.5, y: 0.8 }, onMove: null };

  function ensureEls(container) {
    if (els) return els;
    const frame = document.createElement("div"); frame.className = "xp-frame";
    const chip = document.createElement("div"); chip.className = "xp-title";
    chip.textContent = "Title";
    container.appendChild(frame); container.appendChild(chip);
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
      layoutEls();
      if (state.onMove) state.onMove(nx, ny);
    });
    els = { frame, chip };
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
  }

  function mount(map, opts) {
    opts = opts || {};
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
    setTitlePos(p){ state.titlePos=p; layoutEls(); } };
})();
