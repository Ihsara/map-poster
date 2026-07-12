// web/__tests__/aoi-source-refresh.test.js — regression: the `aoi-buildings`
// GeoJSON source must be re-fed when the store switches AOI.
//
// The bug (shipped on master, found 2026-07-12): categoryLayer.ensure() only
// ever ADDED the source ("if (!map.getSource(SRC))") and never called
// setData(). So the first AOI loaded won the source forever — selecting Gò Vấp
// after Bình Thạnh kept rendering Bình Thạnh's footprints, while the paint
// expression was rebuilt from Gò Vấp's per-idx maps. Because both districts have
// ~4,470 buildings, the idx values collided and lit up, so it looked like real
// data rather than a stale source.
//
// Every OTHER layer in the app already re-datas on switch (ward_layer.js:124/151/190,
// boundary_mask.js:311, and even the big-venue source in category_layer.js:183);
// the buildings source was the sole omission.
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// category_layer.js is a browser IIFE that assigns window.categoryLayer.
// Evaluate it against a jsdom-ish global rather than import()ing it.
function loadCategoryLayer() {
  const src = fs.readFileSync(path.join(HERE, "..", "category_layer.js"), "utf8");
  const g = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function("window", src)(g.window);
  return g.window.categoryLayer;
}

// Minimal MapLibre stand-in: records addSource/setData so we can assert which
// FeatureCollection the source is actually holding.
function fakeMap() {
  const sources = {}, layers = {}, paint = {};
  return {
    sources, layers, paint,
    getStyle: () => ({ layers: [{ id: "sym", type: "symbol" }] }),
    getSource: (id) => sources[id],
    addSource: (id, spec) => {
      sources[id] = {
        _data: spec.data,
        setData(d) { this._data = d; },
      };
    },
    getLayer: (id) => layers[id],
    addLayer: (spec) => { layers[spec.id] = spec; },
    setPaintProperty: (lyr, prop, val) => { (paint[lyr] ||= {})[prop] = val; },
    setLayoutProperty: () => {},
  };
}

// Two AOIs with disjoint geometry, so a stale source is unambiguous.
const bldg = (id, x, y) => ({
  type: "Feature",
  properties: { idx: id },
  geometry: { type: "Polygon", coordinates: [[[x, y], [x + 0.001, y], [x + 0.001, y + 0.001], [x, y]]] },
});

const BINH_THANH = {
  id: "binh-thanh",
  buildings: { type: "FeatureCollection", features: [bldg(0, 106.70, 10.80), bldg(1, 106.71, 10.81)] },
};
const GO_VAP = {
  id: "go-vap",
  buildings: { type: "FeatureCollection", features: [bldg(0, 106.64, 10.84), bldg(1, 106.65, 10.85)] },
};

// Stand-in for aoiStore: `current` is swapped by select(), exactly as aoi.js does.
function fakeStore(initial) {
  let current = initial;
  return {
    select(aoi) { current = aoi; },
    get current() { return current; },
    buildingsFC: () => current && current.buildings,
    buildingCat: () => ({}),
    categoryTree: () => [],
  };
}

const firstX = (fc) => fc.features[0].geometry.coordinates[0][0][0];

describe("aoi-buildings source refresh on AOI switch", () => {
  let categoryLayer;
  beforeEach(() => { categoryLayer = loadCategoryLayer(); });

  it("adds the source with the first AOI's buildings", () => {
    const map = fakeMap(), store = fakeStore(BINH_THANH);
    categoryLayer.ensure(map, store);
    expect(firstX(map.getSource("aoi-buildings")._data)).toBeCloseTo(106.70, 5);
  });

  it("RE-FEEDS the source when the store switches AOI (regression)", () => {
    const map = fakeMap(), store = fakeStore(BINH_THANH);
    categoryLayer.ensure(map, store);

    store.select(GO_VAP);
    categoryLayer.ensure(map, store);

    const held = map.getSource("aoi-buildings")._data;
    // Before the fix this was still Bình Thạnh (106.70) — the user's
    // "I picked Gò Vấp and it drew Bình Thạnh".
    expect(firstX(held)).toBeCloseTo(106.64, 5);
    expect(held).toBe(GO_VAP.buildings);
  });

  it("does not thrash setData when the AOI has not changed", () => {
    const map = fakeMap(), store = fakeStore(BINH_THANH);
    categoryLayer.ensure(map, store);
    const src = map.getSource("aoi-buildings");
    let sets = 0;
    const orig = src.setData.bind(src);
    src.setData = (d) => { sets++; orig(d); };

    categoryLayer.ensure(map, store);
    categoryLayer.ensure(map, store);
    expect(sets).toBe(0); // same FC identity -> no redundant upload
  });
});
