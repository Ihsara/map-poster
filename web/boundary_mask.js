// Boundary spotlight: fade everything OUTSIDE the subject polygon so a poster
// titled "Bình Thạnh" actually makes Bình Thạnh the hero, not all of HCMC.
//
// Design intent (this is a deliberate cartographic move, not a crop): the
// boundary stays full-strength; everything beyond its edge is washed toward
// the theme land color, with a thin dashed hairline on the edge so the
// boundary itself stays legible. A hard clip would read as a sticker.
//
// Task 12: the wash used to be a SINGLE flat-opacity (0.85) fill — a hard
// step right at the boundary edge that reads like a sticker cutout. This is
// replaced with a GRADUATED SMOOTHSTEP FEATHER: a stack of N concentric
// "outside" ring bands between the boundary and a fully-washed outer region.
// Band k (0-indexed, nearest the boundary first) covers the annulus from
// smoothstep-fraction k/N to (k+1)/N of the feather band, painted at alpha
// smoothstep((k+1)/N) * 0.85 — so alpha ramps smoothly from near-zero at the
// boundary to the 0.85 max wash at the outer edge of the band, with zero
// slope at both ends (the "soft" look smoothstep is chosen for).
//
// Ring construction WITHOUT turf (not available in-scope): each ring is the
// boundary's outer ring(s) scaled outward around the polygon's centroid by
// (1 + offsetDeg/meanRadiusDeg). This is an approximation — true polygon
// buffering (offsetting every edge outward by a constant perpendicular
// distance) is exact for a circle and only approximate for a non-convex
// shape, where scale-from-centroid can pinch concave inlets or overshoot
// convex prongs relative to a true buffer. Bình Thạnh's district boundary is
// a river-hugging blob (concave in a few places along the Sài Gòn river
// bends) so the approximation is visibly imperfect at very close inspection,
// but at the feather's intended READ (a soft aura, not a precise offset
// contour) the difference is not perceptible — see task-12-report.md for the
// visual self-review. If a future task adds a real geodesic buffer (turf.js
// or equivalent), swap buildFeatherRings' ring-offset logic only; the rest
// of this module (band alphas, layer wiring, moveend recompute) is
// unaffected.
//
// Rewritten as a MapLibre-layer module (world-ring-with-hole fill + dashed
// line) so it works on the LIVE map and generalizes to ANY polygon (district
// or ward), not just the hardcoded Bình Thạnh centroid from the earlier
// canvas-2D "terraink port". The previous canvas-2D helpers
// (makeProjector/applyBoundaryMask/strokeBoundary/compositeBakedMask) were
// unwired (nothing called them; export.js explicitly skipped the boundary
// mask) and are superseded by this module.
(function () {
  const SRC = "aoi-boundary", FILL_PREFIX = "aoi-fade-", LINE = "aoi-boundary-line";
  const RING_COUNT = 6; // number of concentric feather bands
  const MAX_WASH = 0.85;

  // fadeMath: Task 12's pure smoothstep/featherBandFraction functions live in
  // web-src/fade-math.js (ES module, unit-tested) and are exposed on
  // window.fadeMath by main.jsx's import side-effect. This IIFE is a plain
  // <script>, not a module, so it reads them off window with a fallback in
  // case main.jsx's bundle hasn't run yet (e.g. poster.legacy.html without
  // the Preact bundle) — the fallback keeps the feather math identical to
  // fade-math.js's own constants, just inlined.
  function fadeMath() {
    return (
      window.fadeMath || {
        smoothstep: (t) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); },
        featherBandFraction: (diagonalPx, viewportWidthPx) => {
          const BASE = 0.18, MAXF = 0.22, REF = 1440;
          if (!viewportWidthPx || viewportWidthPx >= REF) return BASE;
          return Math.min(MAXF, BASE * (REF / viewportWidthPx));
        },
      }
    );
  }

  // Flatten a Polygon/MultiPolygon geometry into an array of linear rings.
  function ringsOf(g) {
    if (!g) return [];
    if (g.type === "Feature") return ringsOf(g.geometry);
    if (g.type === "Polygon") return g.coordinates;
    if (g.type === "MultiPolygon") return g.coordinates.flat();
    return [];
  }

  // Centroid of a set of rings (simple vertex-average — good enough for a
  // scale-from-centroid buffer approximation; doesn't need to be the true
  // area centroid).
  function centroidOf(rings) {
    let sx = 0, sy = 0, n = 0;
    for (const ring of rings) {
      for (const [x, y] of ring) { sx += x; sy += y; n++; }
    }
    return n ? [sx / n, sy / n] : [0, 0];
  }

  // Mean distance (degrees) from the centroid to the ring vertices — used as
  // the "radius" in the scale-from-centroid buffer approximation so the
  // offset-to-scale-factor conversion is shape-relative rather than a
  // hardcoded constant.
  function meanRadiusOf(rings, centroid) {
    let sum = 0, n = 0;
    for (const ring of rings) {
      for (const [x, y] of ring) {
        sum += Math.hypot(x - centroid[0], y - centroid[1]);
        n++;
      }
    }
    return n ? sum / n : 0.001;
  }

  // Scale a ring outward around the centroid by factor `scale` (>1 grows the
  // ring outward — the approximate "buffer"). See module header for why
  // scale-from-centroid is used instead of a true perpendicular-edge buffer.
  function scaleRing(ring, centroid, scale) {
    return ring.map(([x, y]) => [
      centroid[0] + (x - centroid[0]) * scale,
      centroid[1] + (y - centroid[1]) * scale,
    ]);
  }

  const WORLD_RING = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];

  // Degrees-to-meters conversion for turf.buffer's meters-based offsets.
  // 111320 m/deg is the standard equatorial-degree approximation (good
  // enough for a soft feather aura, not a survey-grade conversion).
  const METERS_PER_DEGREE = 111320;

  // Buffer polygonGeoJSON outward by offsetMeters using turf.buffer (a true
  // geodesic offset — exact on concave shapes, unlike scale-from-centroid).
  // Returns { rings, mode } — rings is null when turf is unavailable so the
  // caller can fall back to the centroid-scale approximation.
  function bufferRings(polygonGeoJSON, offsetMeters, turf) {
    if (turf && typeof turf.buffer === "function") {
      const f = polygonGeoJSON.type === "Feature"
        ? polygonGeoJSON : { type: "Feature", geometry: polygonGeoJSON };
      const b = turf.buffer(f, offsetMeters, { units: "meters" });
      return { rings: ringsOf(b), mode: "turf" };
    }
    return { rings: null, mode: "fallback" };
  }

  // Build ONE band annulus feature: the polygon buffered outward by
  // outerOffsetMeters, with the ORIGINAL boundary rings punched out as
  // holes. Exposed for unit test + wiring (window.__bandAnnulus below).
  // Uses turf.buffer when present (see module header for why this replaces
  // the old scale-from-centroid approximation on concave shapes); falls
  // back to null rings (mode "fallback") when turf is unavailable, letting
  // the caller run the original scale-from-centroid path unchanged.
  function __bandAnnulus(polygonGeoJSON, outerOffsetMeters, turf) {
    const outer = bufferRings(polygonGeoJSON, outerOffsetMeters, turf);
    const boundaryRings = ringsOf(polygonGeoJSON);
    const outerRings = outer.rings || boundaryRings;
    return {
      __mode: outer.mode,
      rings: outer.rings,
      feature: {
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: outerRings.map(
            (r, i) => [r, boundaryRings[i] || boundaryRings[0]]
          ),
        },
      },
    };
  }
  window.__bandAnnulus = __bandAnnulus;

  // Build the RING_COUNT concentric feather-band FILL features: each is a
  // world-ring-with-holes annulus between two successive buffer offsets of
  // the boundary, painted at a smoothstep-ramped alpha. bandOffsetDeg is the
  // OUTER edge's buffer distance (in degrees) for the whole feather band
  // (i.e. band k's outer ring is buffered by bandOffsetDeg * (k+1)/RING_COUNT).
  //
  // When turf is available (window.turf, vendored in web/vendor/turf.min.js)
  // each band's outer ring is a TRUE geodesic buffer of the original
  // boundary via turf.buffer — exact on concave shapes, fixing the "Bình
  // Quới vanish" pinch that scale-from-centroid produced on river-hugging
  // inlets. When turf is unavailable, the whole original scale-from-
  // centroid path runs unchanged as the fallback.
  function buildFeatherRings(rings, bandOffsetDeg, polygonGeoJSON, turf) {
    const centroid = centroidOf(rings);
    const meanRadius = Math.max(meanRadiusOf(rings, centroid), 1e-6);
    const { smoothstep } = fadeMath();

    const useTurf = !!(turf && typeof turf.buffer === "function");
    window.__boundaryBufferMode = useTurf ? "turf" : "fallback";

    const bands = [];
    let innerRings = rings; // band 0's inner edge is the true boundary itself
    for (let k = 0; k < RING_COUNT; k++) {
      const outerFraction = (k + 1) / RING_COUNT;
      const outerOffsetDeg = bandOffsetDeg * outerFraction;

      let outerRings;
      if (useTurf) {
        const offsetMeters = outerOffsetDeg * METERS_PER_DEGREE;
        const annulus = __bandAnnulus(polygonGeoJSON, offsetMeters, turf);
        outerRings = annulus.rings || rings;
      } else {
        const outerScale = 1 + outerOffsetDeg / meanRadius;
        outerRings = rings.map((ring) => scaleRing(ring, centroid, outerScale));
      }

      // Annulus band = a MultiPolygon whose each element is ONE polygon of
      // [outerRing, innerRing] — outer ring with the inner ring punched out
      // as a HOLE. This fills ONLY the k-th annulus (between successive
      // buffer offsets), transparent inside the inner ring — so band alphas
      // don't stack solid over the whole near-boundary region.
      //
      // BUG FIXED (Task 12 review): the previous construction pushed the
      // outer and inner rings as SEPARATE single-ring polygons
      // (coordinates.map(r => [r]) → [[[outer]],[[inner]]]) = two solid
      // disks per band, so every band filled solid from the true boundary
      // outward and their alphas over-blended to ~0.99 right at the edge —
      // a hard step (masked only because Carrara's land is near-white).
      // Pairing [outer, inner] per polygon makes each band a true hole-
      // punched annulus, restoring the intended faint-near → 0.85-far ramp.
      const coordinates = outerRings.map((outer, i) => [outer, innerRings[i] || rings[i]]);

      bands.push({
        id: FILL_PREFIX + k,
        alpha: smoothstep(outerFraction) * MAX_WASH,
        feature: { type: "Feature", geometry: { type: "MultiPolygon", coordinates } },
      });

      innerRings = outerRings;
    }

    // Final "fully washed" region: everything beyond the outermost band, out
    // to the world edge, at the flat max wash (no further gradation needed —
    // by construction the ramp has already reached MAX_WASH by here).
    const outsideAll = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [WORLD_RING, ...innerRings] },
    };

    return { bands, outsideAll };
  }

  // Estimate the boundary's on-screen diagonal in pixels (for
  // featherBandFraction's diagonalPx argument) and the current viewport
  // width, using the live MapLibre map's projection. Falls back to a fixed
  // diagonal ratio if the map has no usable size yet.
  function screenBandOffsetDeg(map, rings) {
    const centroid = centroidOf(rings);
    const meanRadius = Math.max(meanRadiusOf(rings, centroid), 1e-6);

    let diagonalPx = 600, viewportWidthPx = 1440;
    try {
      const container = map.getContainer && map.getContainer();
      viewportWidthPx = (container && container.clientWidth) || viewportWidthPx;
      const viewportHeightPx = (container && container.clientHeight) || viewportWidthPx * 0.75;
      diagonalPx = Math.hypot(viewportWidthPx, viewportHeightPx);

      if (map.project) {
        // Boundary's on-screen diagonal: project the centroid and a
        // far vertex, use their pixel distance * 2 as a diagonal proxy.
        const c = map.project(centroid);
        let maxPx = 0;
        for (const ring of rings) {
          for (const [x, y] of ring) {
            const p = map.project([x, y]);
            maxPx = Math.max(maxPx, Math.hypot(p.x - c.x, p.y - c.y));
          }
        }
        if (maxPx > 0) diagonalPx = maxPx * 2;
      }
    } catch (e) {
      // map not fully initialized (e.g. mid-style-swap) — use the fallback
      // diagonal/viewport above.
    }

    const { featherBandFraction } = fadeMath();
    const fraction = featherBandFraction(diagonalPx, viewportWidthPx);
    // Convert the screen-relative band fraction back into a degrees offset:
    // fraction is "band width / boundary on-screen diagonal", and the
    // boundary's on-screen diagonal corresponds to ~2*meanRadius degrees
    // (mean vertex distance from centroid, doubled) — so the degrees-per-
    // pixel ratio is meanRadius / (diagonalPx / 2).
    const degPerHalfDiagonal = meanRadius; // meanRadius already ~= half the shape's span
    const bandOffsetDeg = fraction * degPerHalfDiagonal * 2;
    return Math.max(bandOffsetDeg, 1e-5);
  }

  // Fade everything OUTSIDE polygonGeoJSON toward the theme land color, on
  // the live MapLibre map. polygonGeoJSON may be a Polygon/MultiPolygon
  // geometry or a Feature wrapping one.
  window.applyBoundaryFade = function (map, polygonGeoJSON, theme) {
    if (!map || !polygonGeoJSON) return;

    const rings = ringsOf(polygonGeoJSON);
    if (!rings.length) return;

    const landColor = (theme && theme.map && theme.map.land) || "#f3ecdd";
    const bandOffsetDeg = screenBandOffsetDeg(map, rings);
    const { bands, outsideAll } = buildFeatherRings(rings, bandOffsetDeg, polygonGeoJSON, window.turf);

    // Ensure the shared source (for the fully-washed outer region) + each
    // ring band's own source/layer exist, in ascending band order so band 0
    // (faintest, nearest the boundary) sits directly outside the boundary
    // and later bands paint further out — MapLibre draws layers in the
    // order they were added, so add innermost-first, outer-wash-last.
    if (map.getSource(SRC)) map.getSource(SRC).setData(outsideAll);
    else map.addSource(SRC, { type: "geojson", data: outsideAll });

    if (!map.getLayer(FILL_PREFIX + "outer")) {
      map.addLayer({
        id: FILL_PREFIX + "outer", type: "fill", source: SRC,
        paint: { "fill-color": landColor, "fill-opacity": MAX_WASH },
      });
    } else {
      map.setPaintProperty(FILL_PREFIX + "outer", "fill-color", landColor);
    }

    for (const band of bands) {
      const srcId = band.id + "-src";
      if (map.getSource(srcId)) map.getSource(srcId).setData(band.feature);
      else map.addSource(srcId, { type: "geojson", data: band.feature });

      if (!map.getLayer(band.id)) {
        map.addLayer(
          {
            id: band.id, type: "fill", source: srcId,
            paint: { "fill-color": landColor, "fill-opacity": band.alpha },
          },
          FILL_PREFIX + "outer" // insert each band BELOW the outer flat-wash layer
        );
      } else {
        map.setPaintProperty(band.id, "fill-color", landColor);
        map.setPaintProperty(band.id, "fill-opacity", band.alpha);
      }
    }

    // Dashed hairline on the boundary edge (keep legible) — stays on the
    // TRUE boundary, unaffected by the feather approximation.
    const geometry = polygonGeoJSON.type === "Feature" ? polygonGeoJSON.geometry : polygonGeoJSON;
    const edge = { type: "Feature", geometry };
    if (map.getSource(LINE)) {
      map.getSource(LINE).setData(edge);
    } else {
      map.addSource(LINE, { type: "geojson", data: edge });
      map.addLayer({
        id: LINE, type: "line", source: LINE,
        paint: {
          "line-color": (theme && theme.ui && theme.ui.text) || "#333",
          "line-width": 1.2, "line-dasharray": [3, 2], "line-opacity": 0.7,
        },
      });
    }
  };

  // Thin wrapper kept for existing/future callers that just want "fade to
  // the current AOI's district boundary" without handling polygons
  // themselves.
  window.applyDistrictFade = function (map, theme) {
    if (!window.aoiStore) return;
    const poly = window.aoiStore.boundaryPolygon();
    if (poly) window.applyBoundaryFade(map, poly, theme);
  };
})();
