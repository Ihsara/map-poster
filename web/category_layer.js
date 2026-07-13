// web/category_layer.js — lights building footprints by the current category selection.
window.categoryLayer = (function () {
  const SRC = "aoi-buildings", LYR = "aoi-cat-fill";
  function firstSymbolId(map) {
    for (const l of map.getStyle().layers) if (l.type === "symbol") return l.id;
    return undefined;
  }
  function ensure(map, store) {
    const fc = store.buildingsFC(); if (!fc) return;
    const src = map.getSource(SRC);
    if (!src) {
      // generateId: true — MapLibre assigns each feature a stable id (its
      // position in `fc.features`), which applyClip() uses via ["id"]
      // instead of the removed properties.idx join.
      map.addSource(SRC, { type: "geojson", data: fc, generateId: true });
    } else if (src._aoiFC !== fc) {
      // AOI switched: re-feed the source. Without this the FIRST AOI loaded owned
      // the source forever — every later AOI rendered the first one's footprints
      // while the paint expression was rebuilt from the NEW AOI's per-idx maps.
      // Districts have similar building counts, so the idx values collided and lit
      // up: picking Gò Vấp drew Bình Thạnh. Every other layer already re-datas on
      // switch (ward_layer, boundary_mask, and the big-venue source below).
      src.setData(fc);
    }
    // Track identity on the source so repeated ensure() calls for the same AOI
    // don't re-upload an unchanged FeatureCollection.
    const cur = map.getSource(SRC);
    if (cur) cur._aoiFC = fc;
    if (!map.getLayer(LYR))
      map.addLayer({ id: LYR, type: "fill", source: SRC,
        paint: { "fill-color": "#cccccc", "fill-opacity": 0 } }, firstSymbolId(map));
  }

  // Task 8/3: which buildings (by MapLibre FEATURE ID, not a baked
  // `properties.idx` — Task 2 removed that property) fall inside
  // clipPolygon, so applyClip() can restrict the layer to them via
  // setFilter(["in", ["id"], ["literal", ids]]). `["id"]` works here
  // because ensure() adds the source with `generateId: true`, so MapLibre
  // assigns every feature a stable id = its position in the
  // FeatureCollection's features array — exactly the old idx's identity,
  // without touching `properties` at all.
  //
  // Centroid = a simple vertex-average of the feature's OUTER ring (good
  // enough for a "is this building roughly inside the focus polygon"
  // membership test, not a true area centroid). Runtime-derived (no bake
  // step) — see task-8-report.md.
  //
  // Why this stays a JS centroid filter instead of a `["within", ...]`
  // layer filter: the vendored maplibre-gl 5.19.0's `within` expression
  // `evaluate()` only branches on feature geometryType() "Point" and
  // "LineString" — there is no "Polygon" branch, so for a fill layer's
  // Polygon-geometry building footprints it always falls through to
  // `return false`, silently clipping every building. Verified by reading
  // web/vendor/maplibre-gl.js directly (see task-3-report.md). The brief's
  // documented fallback applies: paint-expression port is mandatory, the
  // clip optimization is a bonus, so the existing centroid clip stays.
  // MINOR fix (final review, 2026-07-13): aoi_geom.buildings_geojson emits
  // MultiPolygon for multi-part footprints, but this used to bail out (`g.type
  // !== "Polygon"`) on anything that wasn't a plain Polygon -- so every
  // MultiPolygon building vanished from the lit fill under ANY focus clip,
  // wrong-poster silently. Vertex-average of the OUTER ring of the LARGEST
  // part (by absolute shoelace area) is the same "good enough for membership,
  // not a true area centroid" approximation the single-Polygon path already
  // uses one tier up -- justified because a focus clip cares about roughly
  // where a building sits, and the biggest part of a multi-part footprint is
  // the part most representative of that.
  function _ringArea(ring) {
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a) / 2;
  }

  function _outerRingOf(geometry) {
    if (!geometry || !geometry.coordinates) return null;
    if (geometry.type === "Polygon") {
      return geometry.coordinates[0] || null;
    }
    if (geometry.type === "MultiPolygon") {
      let best = null, bestArea = -1;
      for (const part of geometry.coordinates) {
        const ring = part && part[0];
        if (!ring || !ring.length) continue;
        const area = _ringArea(ring);
        if (area > bestArea) { bestArea = area; best = ring; }
      }
      return best;
    }
    return null;
  }

  function clipFeatureIds(store, clipPolygon) {
    if (!clipPolygon) return null;
    const fc = store.buildingsFC();
    if (!fc || !fc.features) return [];
    const rings = window.__ringsOf(clipPolygon);
    const ids = [];
    fc.features.forEach((feature, i) => {
      const ring = _outerRingOf(feature.geometry);
      if (!ring) return;
      let sx = 0, sy = 0, n = 0;
      for (const [x, y] of ring) { sx += x; sy += y; n++; }
      if (!n) return;
      const centroid = [sx / n, sy / n];
      if (window.__pointInPolygon(centroid, rings)) ids.push(i);
    });
    return ids;
  }

  // applyClip(map, layerId, store, clipPolygon): restrict layerId to
  // buildings whose centroid falls inside clipPolygon (null/absent -> no
  // filter, today's whole-district behavior).
  function applyClip(map, layerId, store, clipPolygon) {
    if (!map.setFilter) return;
    if (!clipPolygon) { map.setFilter(layerId, null); return; }
    const ids = clipFeatureIds(store, clipPolygon);
    map.setFilter(layerId, ["in", ["id"], ["literal", ids]]);
  }

  // selection: array of {domainId, childId|null}. A building lights if any of its
  // OWN `cats` matches a selected leaf, or its `dom` matches a selected domain.
  // Paint is a data-driven expression over feature properties — there is no
  // per-building stop list and no idx join.
  //
  // clipPolygon (Task 8, optional 6th param): when truthy, only buildings
  // whose centroid falls inside it contribute a fill stop — same clip
  // semantics as bloom() below. Null/absent -> today's whole-district
  // behavior, byte-identical (no centroid work, no filtering). See
  // applyClip() above for why this stays a JS centroid filter rather than
  // a `["within", ...]` expression.
  function update(map, store, selection, mode, theme, clipPolygon) {
    ensure(map, store);
    const tree = store.categoryTree();
    const leafColor = {};   // leafId -> hex
    for (const sel of selection) {
      const dom = tree.find(d => d.id === sel.domainId); if (!dom) continue;
      if (sel.childId) {
        const i = dom.children.findIndex(c => c.id === sel.childId);
        leafColor[sel.childId] = window.palettes.color(mode, theme, dom.id, i, dom.children.length);
      } else {
        dom.children.forEach((c, i) =>
          leafColor[c.id] = window.palettes.color(mode, theme, dom.id, i, dom.children.length));
      }
    }
    const leaves = Object.keys(leafColor);
    if (!leaves.length) { map.setPaintProperty(LYR, "fill-opacity", 0); return; }

    // colour: first selected leaf this building carries wins (deterministic —
    // `leaves` is in selection order, matching the old `leaves.find(...)`).
    const color = ["case"];
    for (const leaf of leaves) {
      color.push(["in", leaf, ["get", "cats"]], leafColor[leaf]);
    }
    color.push("#000000");

    const lit = ["any", ...leaves.map(l => ["in", l, ["get", "cats"]])];
    map.setPaintProperty(LYR, "fill-color", color);
    map.setPaintProperty(LYR, "fill-opacity", ["case", lit, 0.85, 0]);
    applyClip(map, LYR, store, clipPolygon);
  }

  // --- Task 11: Bloom mode --------------------------------------------
  const BLOOM_LYR = "aoi-bloom-fill";
  const VENUE_SRC = "aoi-bigvenues", VENUE_LYR_RING = "aoi-bigvenues-ring",
        VENUE_LYR_DOT = "aoi-bigvenues-dot";

  function ensureBloomLayer(map) {
    if (!map.getSource(SRC)) return false; // ensure() must have run (buildings loaded)
    if (!map.getLayer(BLOOM_LYR))
      map.addLayer({ id: BLOOM_LYR, type: "fill", source: SRC,
        paint: { "fill-color": "#cccccc", "fill-opacity": 0 } }, firstSymbolId(map));
    return true;
  }

  // bloom(map, store, dominantColorFn, theme, clipPolygon): lights EVERY lit
  // building by its OWN dominant domain (`properties.dom`), via
  // dominantColorFn(domain) -> hex, EXCLUDING big venues (features flagged
  // `properties.bv: true` — Task 2 moved that flag onto the feature itself;
  // the key is ABSENT otherwise, never `false`) — those get their own
  // marker layer instead (see bigVenues() below). Runs on its own layer id
  // so the ordinary selection fill (update(), above) stays untouched/
  // independent — bloom is additive, not a rewrite of the selection path.
  //
  // clipPolygon (Task 8, optional 5th param): when truthy, only buildings
  // whose centroid falls inside it contribute to the bloom fill — this is
  // how Bloom clips to the currently-focused ward/district/HCMC polygon
  // instead of always lighting the whole baked district. See applyClip()
  // above for why this is still a JS centroid filter, not a `within`
  // expression. Null/absent clipPolygon -> today's whole-district behavior,
  // byte-identical (no centroid work, no filtering).
  function bloom(map, store, dominantColorFn, theme, clipPolygon) {
    ensure(map, store);
    if (!ensureBloomLayer(map)) return;
    const tree = store.categoryTree() || [];
    const domains = tree.map(d => d.id);
    const color = ["case"];
    for (const d of domains) {
      const c = dominantColorFn(d);
      if (c) color.push(["==", ["get", "dom"], d], c);
    }
    color.push("#000000");
    // lit = has a dom AND is not a big venue
    const lit = ["all", ["has", "dom"], ["!", ["has", "bv"]]];
    map.setPaintProperty(BLOOM_LYR, "fill-color", color);
    map.setPaintProperty(BLOOM_LYR, "fill-opacity", ["case", lit, 0.75, 0]);
    applyClip(map, BLOOM_LYR, store, clipPolygon);
  }

  // clearBloom(map): idempotent hide of the bloom fill (bloom off).
  function clearBloom(map) {
    if (map.getLayer && map.getLayer(BLOOM_LYR)) map.setPaintProperty(BLOOM_LYR, "fill-opacity", 0);
  }

  function ensureVenueLayers(map) {
    if (!map.getSource(VENUE_SRC))
      map.addSource(VENUE_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    // Ringed-circle look (outer ring + inner dot) so big venues read as
    // distinct landmarks, not just another bloom-colored blob.
    if (!map.getLayer(VENUE_LYR_RING))
      map.addLayer({ id: VENUE_LYR_RING, type: "circle", source: VENUE_SRC,
        paint: {
          "circle-radius": 9,
          "circle-color": "#ffffff",
          "circle-opacity": 0.15,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.9,
        } });
    if (!map.getLayer(VENUE_LYR_DOT))
      map.addLayer({ id: VENUE_LYR_DOT, type: "circle", source: VENUE_SRC,
        paint: {
          "circle-radius": 3.5,
          "circle-color": "#ffffff",
          "circle-opacity": 0.95,
        } });
  }

  // bigVenues(map, bigVenues, on): renders the big-venue markers (malls,
  // markets — footprints with >=4 places across >=2 domains, baked by
  // Task 9) on their own point layer, toggled by `on`.
  function bigVenues(map, venues, on) {
    ensureVenueLayers(map);
    const fc = {
      type: "FeatureCollection",
      features: (venues || []).map(v => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: v.marker },
        properties: { id: v.id, domains: (v.domains || []).join(",") },
      })),
    };
    map.getSource(VENUE_SRC).setData(fc);
    const vis = on ? "visible" : "none";
    map.setLayoutProperty(VENUE_LYR_RING, "visibility", vis);
    map.setLayoutProperty(VENUE_LYR_DOT, "visibility", vis);
  }

  return { ensure, update, bloom, clearBloom, bigVenues };
})();
