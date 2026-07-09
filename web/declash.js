// Honesty-leashed declash for the marks WE draw on the export canvas (hero
// label, legend, furniture) — NOT MapLibre's own labels (it collision-manages
// those). Ported from binh-thanh-story hub.js: iterative pairwise push-apart,
// each mark clamped to maxNudge of its true origin (so a label never drifts far
// from what it names), pinned marks fixed.
(function () {
  // items: [{x,y,w,h,pinned?}] with x,y = mark CENTER. Two marks "clash" when
  // their centers are closer than half the sum of their extents + minSep slack.
  function declashMarks(items, opts) {
    const o = opts || {};
    const minSep = o.minSep != null ? o.minSep : 8;
    const maxNudge = o.maxNudge != null ? o.maxNudge : 60;
    const iters = o.iters != null ? o.iters : 24;
    const orig = items.map(it => ({ x: it.x, y: it.y }));
    for (let k = 0; k < iters; k++) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          // required center separation so bounding boxes don't overlap
          const needX = (a.w + b.w) / 2 + minSep;
          const needY = (a.h + b.h) / 2 + minSep;
          const dx = b.x - a.x, dy = b.y - a.y;
          const ox = needX - Math.abs(dx);   // overlap on each axis (>0 = clash)
          const oy = needY - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            // push along the axis of least penetration (cleaner separation)
            if (ox < oy) {
              const push = ox / 2, s = dx < 0 ? -1 : 1;
              if (!a.pinned) a.x -= s * push;
              if (!b.pinned) b.x += s * push;
            } else {
              const push = oy / 2, s = dy < 0 ? -1 : 1;
              if (!a.pinned) a.y -= s * push;
              if (!b.pinned) b.y += s * push;
            }
          }
        }
      }
      items.forEach((it, idx) => {
        if (it.pinned) { it.x = orig[idx].x; it.y = orig[idx].y; return; }
        const dx = it.x - orig[idx].x, dy = it.y - orig[idx].y;
        const d = Math.hypot(dx, dy);
        if (d > maxNudge) { it.x = orig[idx].x + dx / d * maxNudge; it.y = orig[idx].y + dy / d * maxNudge; }
      });
    }
    return items;
  }

  function _ringCentroid(ring) {
    // area-weighted centroid of a single ring (shoelace)
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, n = ring.length - 1; i < n; i++) {
      const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
    }
    if (Math.abs(a) < 1e-12) {   // degenerate: fall back to vertex mean
      let mx = 0, my = 0; ring.forEach(([x, y]) => { mx += x; my += y; });
      return [mx / ring.length, my / ring.length, 0];
    }
    a *= 0.5;
    return [cx / (6 * a), cy / (6 * a), Math.abs(a)];
  }

  function polygonCentroid(feature) {
    const geom = feature.geometry || feature;
    const outers = [];
    if (geom.type === "Polygon") outers.push(geom.coordinates[0]);
    else if (geom.type === "MultiPolygon") geom.coordinates.forEach(p => outers.push(p[0]));
    let A = 0, X = 0, Y = 0;
    outers.forEach(ring => {
      const [cx, cy, area] = _ringCentroid(ring);
      A += area; X += cx * area; Y += cy * area;
    });
    if (A < 1e-12) { const [cx, cy] = _ringCentroid(outers[0]); return [cx, cy]; }
    return [X / A, Y / A];
  }

  function drawEdgeMark(ctx, { cx, cy, angleDeg, color, r }) {
    const rr = r || 12;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angleDeg * Math.PI / 180);
    ctx.globalAlpha = 0.85; ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-rr * 0.6, -rr * 0.8); ctx.lineTo(rr * 0.8, 0); ctx.lineTo(-rr * 0.6, rr * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  window.declashMarks = declashMarks;
  window.polygonCentroid = polygonCentroid;
  window.drawEdgeMark = drawEdgeMark;
})();
