// web/__tests__/clip-multipolygon.test.js — MINOR fix (final review,
// 2026-07-13): clipFeatureIds() used to skip any feature whose geometry was
// not "Polygon", but aoi_geom.buildings_geojson emits MultiPolygon for
// multi-part footprints -- those buildings vanished entirely from the lit
// fill under any focus clip. This proves a MultiPolygon building survives
// the clip when its (largest-part) centroid falls inside the clip polygon,
// and is excluded when it falls outside -- exactly like a plain Polygon.
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function loadCategoryLayer(win) {
  const src = fs.readFileSync(path.join(HERE, "..", "category_layer.js"), "utf8");
  new Function("window", src)(win);
  return win.categoryLayer;
}

function fakeMap() {
  const sources = {}, layers = {}, paint = {}, filters = {};
  return {
    sources, layers, paint, filters,
    getStyle: () => ({ layers: [{ id: "sym", type: "symbol" }] }),
    getSource: (id) => sources[id],
    addSource: (id, spec) => { sources[id] = { _data: spec.data, setData(d) { this._data = d; } }; },
    getLayer: (id) => layers[id],
    addLayer: (spec) => { layers[spec.id] = spec; },
    setPaintProperty: (l, p, v) => { (paint[l] ||= {})[p] = v; },
    setLayoutProperty: () => {},
    setFilter: (l, f) => { filters[l] = f; },
  };
}

// A square clip polygon covering roughly x:[0,10] y:[0,10].
const CLIP = {
  type: "Polygon",
  coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
};

// A MultiPolygon whose LARGEST part sits inside the clip, and a tiny second
// part far outside -- proving the fix picks the biggest part's centroid, not
// just the first one (or bailing out entirely, the pre-fix bug).
const multiInside = {
  type: "Feature",
  properties: { cats: ["cafe"], dom: "eat_and_drink" },
  geometry: {
    type: "MultiPolygon",
    coordinates: [
      // tiny far-away sliver (would fail membership if picked)
      [[[500, 500], [500.1, 500], [500.1, 500.1], [500, 500.1], [500, 500]]],
      // large part, centroid ~ (5,5), inside CLIP
      [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    ],
  },
};

const multiOutside = {
  type: "Feature",
  properties: { cats: ["cafe"], dom: "eat_and_drink" },
  geometry: {
    type: "MultiPolygon",
    coordinates: [
      [[[500, 500], [510, 500], [510, 510], [500, 510], [500, 500]]],
    ],
  },
};

const plainInside = {
  type: "Feature",
  properties: { cats: ["cafe"], dom: "eat_and_drink" },
  geometry: { type: "Polygon", coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]] },
};

function storeWith(features) {
  const fc = { type: "FeatureCollection", features };
  return {
    buildingsFC: () => fc,
    categoryTree: () => [{ id: "eat_and_drink", children: [{ id: "cafe" }] }],
  };
}

describe("clip handles MultiPolygon building footprints", () => {
  let win;
  beforeEach(() => {
    win = {};
    // Minimal ringsOf/pointInPolygon, mirroring web/boundary_geom.js's real
    // behavior for a single-polygon clip shape (ray-cast against rings[0]).
    win.__ringsOf = (g) => (g.type === "Polygon" ? g.coordinates : g.coordinates.flat());
    win.__pointInPolygon = ([x, y], rings) => {
      const ring = rings[0];
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        const intersects = (yi > y) !== (yj > y) &&
          x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
      }
      return inside;
    };
    win.palettes = { color: () => "#ff0000" };
  });

  it("keeps a MultiPolygon building whose largest part is inside the clip", () => {
    const cl = loadCategoryLayer(win);
    const map = fakeMap();
    const store = storeWith([multiInside, plainInside]);
    cl.update(map, store, [{ domainId: "eat_and_drink", childId: "cafe" }], "mode", "dark", CLIP);
    const ids = map.filters["aoi-cat-fill"][2][1];
    expect(ids).toContain(0); // multiInside survives the clip
    expect(ids).toContain(1); // plainInside survives too
  });

  it("excludes a MultiPolygon building whose only part is outside the clip", () => {
    const cl = loadCategoryLayer(win);
    const map = fakeMap();
    const store = storeWith([multiOutside, plainInside]);
    cl.update(map, store, [{ domainId: "eat_and_drink", childId: "cafe" }], "mode", "dark", CLIP);
    const ids = map.filters["aoi-cat-fill"][2][1];
    expect(ids).not.toContain(0); // multiOutside is clipped out
    expect(ids).toContain(1);     // plainInside still survives
  });
});
