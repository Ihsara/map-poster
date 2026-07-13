// Buildings paint from their OWN properties — no idx-keyed match expression.
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function loadCategoryLayer() {
  const src = fs.readFileSync(path.join(HERE, "..", "category_layer.js"), "utf8");
  // Pass the SAME object as globalThis.window (not a fresh {}), so
  // window.palettes stubbed below (and reassigned per-test in beforeEach)
  // is visible to the loaded module — mirroring how category_layer.js is
  // actually loaded in the browser (a <script> tag sharing one real
  // `window` with palettes.js).
  const g = { window: globalThis.window };
  new Function("window", src)(g.window);
  return g.window.categoryLayer;
}

function fakeMap() {
  const sources = {}, layers = {}, paint = {};
  return {
    sources, layers, paint,
    getStyle: () => ({ layers: [{ id: "sym", type: "symbol" }] }),
    getSource: (id) => sources[id],
    addSource: (id, spec) => { sources[id] = { _data: spec.data, setData(d) { this._data = d; } }; },
    getLayer: (id) => layers[id],
    addLayer: (spec) => { layers[spec.id] = spec; },
    setPaintProperty: (l, p, v) => { (paint[l] ||= {})[p] = v; },
    setLayoutProperty: () => {},
    setFilter: () => {},
  };
}

const feat = (cats, dom, bv) => ({
  type: "Feature",
  properties: bv ? { cats, dom, bv: true } : { cats, dom },
  geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
});

const AOI = {
  id: "test",
  buildings: {
    type: "FeatureCollection",
    features: [feat(["cafe"], "eat_and_drink"), feat(["school"], "education", true)],
  },
  categoryTree: [
    { id: "eat_and_drink", label: "Eat", children: [{ id: "cafe", label: "Cafe" }] },
    { id: "education", label: "Edu", children: [{ id: "school", label: "School" }] },
  ],
  bigVenues: [],
};

const store = {
  current: AOI,
  buildingsFC: () => AOI.buildings,
  categoryTree: () => AOI.categoryTree,
};

// stub the palette the layer reaches for
globalThis.window = globalThis.window || {};

describe("category paint uses feature properties, not idx", () => {
  let cl;
  beforeEach(() => {
    cl = loadCategoryLayer();
    globalThis.window.palettes = { color: () => "#ff0000" };
  });

  it("bloom paints via ['get','dom'] and never via ['get','idx']", () => {
    const map = fakeMap();
    cl.bloom(map, store, () => "#00ff00", "dark", null);
    const expr = JSON.stringify(map.paint["aoi-bloom-fill"]["fill-color"]);
    expect(expr).toContain('["get","dom"]');
    expect(expr).not.toContain('"idx"');
  });

  it("selection paints via cats and never via idx", () => {
    const map = fakeMap();
    cl.update(map, store, [{ domainId: "eat_and_drink", childId: "cafe" }], "mode", "dark", null);
    const expr = JSON.stringify(map.paint["aoi-cat-fill"]);
    expect(expr).not.toContain('"idx"');
    expect(expr).toContain("cats");
  });
});
