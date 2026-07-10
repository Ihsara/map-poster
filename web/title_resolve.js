// web/title_resolve.js
// Shared title-position resolver used by BOTH the export (web/export.js) and
// the WYSIWYG preview (web/export_preview.js) so a dragged/AUTO title lands in
// the SAME normalized spot in the preview and the exported PNG. Extracted from
// export.js's inline AUTO block, behavior-identical. (spec 2026-07-11 §B)
(function () {
  function titleResolve(opts) {
    const o = opts || {};
    if (o.titlePos && typeof o.titlePos.x === "number" && typeof o.titlePos.y === "number") {
      return { x: o.titlePos.x, y: o.titlePos.y };
    }
    const W = o.W, H = o.H, venuesPx = o.venuesPx || [];
    if (window.titlePlacement && venuesPx.length) {
      const titleWH = { w: W * 0.5, h: Math.round(H * 0.12) };
      const r = window.titlePlacement.pick(venuesPx, { w: W, h: H }, titleWH, { threshold: 8 });
      if (r && typeof r.x === "number" && typeof r.y === "number") return { x: r.x, y: r.y };
    }
    return undefined;
  }
  window.titleResolve = titleResolve;
})();
