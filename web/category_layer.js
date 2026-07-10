// web/category_layer.js — lights building footprints by the current category selection.
window.categoryLayer = (function () {
  const SRC = "aoi-buildings", LYR = "aoi-cat-fill";
  function firstSymbolId(map) {
    for (const l of map.getStyle().layers) if (l.type === "symbol") return l.id;
    return undefined;
  }
  function ensure(map, store) {
    const fc = store.buildingsFC(); if (!fc) return;
    if (!map.getSource(SRC)) map.addSource(SRC, { type: "geojson", data: fc });
    if (!map.getLayer(LYR))
      map.addLayer({ id: LYR, type: "fill", source: SRC,
        paint: { "fill-color": "#cccccc", "fill-opacity": 0 } }, firstSymbolId(map));
  }
  // Task 8: build a per-building-idx centroid lookup from the baked
  // buildings FeatureCollection (store.buildingsFC()), keyed by
  // String(feature.properties.idx) — the SAME idx keying used by
  // buildingDominant/buildingCat. Centroid = a simple vertex-average of the
  // feature's OUTER ring (good enough for a "is this building roughly
  // inside the focus polygon" membership test, not a true area centroid).
  // Runtime-derived (no bake step) — see task-8-report.md.
  function centroidsById(store) {
    const fc = store.buildingsFC();
    const centroidById = {};
    if (!fc || !fc.features) return centroidById;
    for (const feature of fc.features) {
      const g = feature.geometry;
      if (!g || g.type !== "Polygon" || !g.coordinates || !g.coordinates[0]) continue;
      const ring = g.coordinates[0];
      let sx = 0, sy = 0, n = 0;
      for (const [x, y] of ring) { sx += x; sy += y; n++; }
      if (!n) continue;
      const idx = feature.properties && feature.properties.idx;
      if (idx === undefined || idx === null) continue;
      centroidById[String(idx)] = [sx / n, sy / n];
    }
    return centroidById;
  }

  // selection: array of {domainId, childId|null}; light a building if any of its
  // leaves matches a selected childId OR its domain matches a selected domain (childId null)
  // clipPolygon (Task 8, optional 6th param): when truthy, only buildings
  // whose centroid falls inside it contribute a fill stop — same clip
  // semantics as bloom() below. Null/absent -> today's whole-district
  // behavior, byte-identical (no centroid work, no filtering).
  function update(map, store, selection, mode, theme, clipPolygon) {
    ensure(map, store);
    const cat = store.buildingCat();
    const tree = store.categoryTree();
    // build idx → color
    const leafColor = {};   // leafId → hex
    for (const sel of selection) {
      const dom = tree.find(d => d.id === sel.domainId); if (!dom) continue;
      if (sel.childId) {
        const idx = dom.children.findIndex(c => c.id === sel.childId);
        leafColor[sel.childId] = window.palettes.color(mode, theme, dom.id, idx, dom.children.length);
      } else {
        dom.children.forEach((c, i) =>
          leafColor[c.id] = window.palettes.color(mode, theme, dom.id, i, dom.children.length));
      }
    }
    const rings = clipPolygon ? window.__ringsOf(clipPolygon) : null;
    const centroidById = rings ? centroidsById(store) : null;
    // MapLibre data-driven fill via a match expression on feature idx
    const stops = [];
    for (const [idx, leaves] of Object.entries(cat)) {
      if (rings) {
        const c = centroidById[String(idx)];
        if (!c || !window.__pointInPolygon(c, rings)) continue;
      }
      const hit = leaves.find(l => leafColor[l]);
      if (hit) stops.push([Number(idx), leafColor[hit]]);
    }
    if (!stops.length) { map.setPaintProperty(LYR, "fill-opacity", 0); return; }
    const expr = ["match", ["get", "idx"]];
    for (const [idx, col] of stops) expr.push(idx, col);
    expr.push("#000000");
    map.setPaintProperty(LYR, "fill-color", expr);
    map.setPaintProperty(LYR, "fill-opacity",
      ["case", ["in", ["get", "idx"], ["literal", stops.map(s => s[0])]], 0.85, 0]);
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
  // building by its dominant domain (store.current.buildingDominant: {idx:
  // domainId}), via dominantColorFn(domain) -> hex, EXCLUDING big-venue idxs
  // (store.current.bigVenues) — those get their own marker layer instead
  // (see bigVenues() below). Runs on its own layer id so the ordinary
  // selection fill (update(), above) stays untouched/independent — bloom is
  // additive, not a rewrite of the selection path.
  //
  // clipPolygon (Task 8, optional 5th param): when truthy, only buildings
  // whose centroid falls inside it (via window.__pointInPolygon against
  // window.__ringsOf(clipPolygon), boundary_geom.js) contribute a bloom fill
  // stop — this is how Bloom clips to the currently-focused ward/district/
  // HCMC polygon instead of always lighting the whole baked district.
  // Centroids are derived at RUNTIME from store.buildingsFC() (no bake
  // step — see task-8-report.md). Null/absent clipPolygon -> today's
  // whole-district behavior, byte-identical (no centroid work, no
  // filtering).
  function bloom(map, store, dominantColorFn, theme, clipPolygon) {
    ensure(map, store);
    if (!ensureBloomLayer(map)) return;
    const current = store.current;
    const buildingDominant = (current && current.buildingDominant) || {};
    const bigVenueIds = new Set(((current && current.bigVenues) || []).map(v => String(v.id)));
    const rings = clipPolygon ? window.__ringsOf(clipPolygon) : null;
    const centroidById = rings ? centroidsById(store) : null;

    const stops = [];
    for (const [idx, domain] of Object.entries(buildingDominant)) {
      if (bigVenueIds.has(String(idx))) continue; // excluded from bloom fill
      if (rings) {
        const c = centroidById[String(idx)];
        if (!c || !window.__pointInPolygon(c, rings)) continue;
      }
      const color = dominantColorFn(domain);
      if (color) stops.push([Number(idx), color]);
    }
    if (!stops.length) { map.setPaintProperty(BLOOM_LYR, "fill-opacity", 0); return; }
    const expr = ["match", ["get", "idx"]];
    for (const [idx, col] of stops) expr.push(idx, col);
    expr.push("#000000");
    map.setPaintProperty(BLOOM_LYR, "fill-color", expr);
    map.setPaintProperty(BLOOM_LYR, "fill-opacity",
      ["case", ["in", ["get", "idx"], ["literal", stops.map(s => s[0])]], 0.75, 0]);
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
