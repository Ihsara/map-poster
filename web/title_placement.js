// Smart title placement: score a 3x3 grid of candidate title anchors by how
// many map points fall under each (busyness), keep the default centered-lower
// spot unless it is too busy, else pick the emptiest fitting zone nearest the
// default. Returns a NORMALIZED (0-1) anchor within the crop. Pure + testable.
(function () {
  const GRID = 3; // 3x3 candidate zones
  const DEFAULT = { x: 0.5, y: 0.80 }; // current look: centered-lower

  function countIn(pointsPx, x0, y0, x1, y1) {
    let n = 0;
    for (const [px, py] of pointsPx) if (px>=x0 && px<x1 && py>=y0 && py<y1) n++;
    return n;
  }

  function pick(pointsPx, cropWH, titleWH, opts) {
    opts = opts || {};
    const threshold = opts.threshold != null ? opts.threshold : 8;
    const { w: W, h: H } = cropWH;
    const tw = titleWH.w, th = titleWH.h;
    // busyness of a zone centered on normalized (nx,ny): count points inside the
    // title block bbox placed there.
    const busynessAt = (nx, ny) => {
      const cx = nx * W, cy = ny * H;
      return countIn(pointsPx, cx - tw/2, cy - th/2, cx + tw/2, cy + th/2);
    };
    const defBusy = busynessAt(DEFAULT.x, DEFAULT.y);
    if (defBusy <= threshold) return { x: DEFAULT.x, y: DEFAULT.y, zone: "default", busyness: defBusy };

    // else scan the grid, prefer lowest busyness, tiebreak toward bottom/edge
    // and nearness to default.
    let best = null;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const nx = (gx + 0.5) / GRID, ny = (gy + 0.5) / GRID;
        // keep the block fully inside the crop
        if (nx*W - tw/2 < 0 || nx*W + tw/2 > W) continue;
        if (ny*H - th/2 < 0 || ny*H + th/2 > H) continue;
        const b = busynessAt(nx, ny);
        const nearDefault = Math.hypot(nx - DEFAULT.x, ny - DEFAULT.y);
        const edgeBias = -(ny) - Math.min(nx, 1 - nx); // lower + edge preferred
        const score = b * 100 + nearDefault * 10 + edgeBias;
        if (!best || score < best.score) best = { x: nx, y: ny, zone: `${gx},${gy}`, busyness: b, score };
      }
    }
    return best || { x: DEFAULT.x, y: DEFAULT.y, zone: "default", busyness: defBusy };
  }

  window.titlePlacement = { pick, DEFAULT };
})();
