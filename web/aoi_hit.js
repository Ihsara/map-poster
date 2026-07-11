// web/aoi_hit.js — pure bbox hit-test for the "AOI available here" affordance.
// Browser global (window.aoiHit) + ES export (tests). No map/DOM.
function _area(b) { return (b[2] - b[0]) * (b[3] - b[1]); }

export function aoiAtPoint(point, manifest) {
  if (!point || !Array.isArray(manifest)) return null;
  const [lng, lat] = point;
  let best = null;
  for (const m of manifest) {
    const b = m && m.bbox;
    if (!b || b.length !== 4) continue;
    if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
    if (!best || _area(b) < _area(best.bbox)) best = m;
  }
  return best;
}

// Expose as a plain global for poster.js / main.jsx (loaded as a <script>).
if (typeof window !== "undefined") {
  window.aoiHit = { aoiAtPoint };
}
