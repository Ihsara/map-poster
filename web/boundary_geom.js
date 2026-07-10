// web/boundary_geom.js — Task 8: shared point-in-polygon helper for clipping
// Bloom + category lighting to the currently-focused polygon.
//
// pointInRings is a plain ray-cast test against the polygon's OUTER ring
// only (rings[0]) — holes are ignored. That is a deliberate simplification:
// this helper is used for a soft "does this building's centroid fall inside
// the focused ward/district/HCMC shape" membership check, not a precise
// geometric containment test, so ignoring holes (a donut-shaped focus unit
// would wrongly include its hole) is an acceptable approximation for this
// clip — none of today's focus units (new_wards/old_wards/district/hcmc)
// are donut shapes in practice.
//
// Exported as an ES module (for the vitest unit test) AND attached to
// `window.__pointInPolygon` (guarded) so category_layer.js — a plain
// <script> global, not a module — can call it too.

export function pointInRings(point, rings) {
  if (!rings || !rings.length) return false;
  const outer = rings[0];
  return pointInRing(point, outer);
}

// Standard ray-casting point-in-polygon test against a single linear ring.
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Flatten a Polygon/MultiPolygon geometry (or a Feature wrapping one) into an
// array of linear rings. Mirrors web/boundary_mask.js's own ringsOf (which
// stays a local closure there, not exported) — for MultiPolygon focus units
// (hcmc, districts) this returns EVERY polygon's rings flattened together,
// so rings[0] (used by pointInRings above) is the first polygon's outer
// ring. Testing membership against only the first/largest polygon's outer
// ring is an accepted approximation for this clip (see task brief) rather
// than a true multi-polygon union containment test.
function ringsOf(g) {
  if (!g) return [];
  if (g.type === "Feature") return ringsOf(g.geometry);
  if (g.type === "Polygon") return g.coordinates;
  if (g.type === "MultiPolygon") return g.coordinates.flat();
  return [];
}

if (typeof window !== "undefined") {
  window.__pointInPolygon = pointInRings;
  window.__ringsOf = ringsOf;
}
