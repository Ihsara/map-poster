// web/__tests__/aoi-hydrate.test.js
//
// focusUnits carries SHARED geometry by reference, never inline:
//   - focusUnits.region    -> geomRef "region-hcmc"      (1 shared file)
//   - focusUnits.districts -> geomRef "district-<id>"    (39 shared files)
// The second tier is the fix for parent-district outlines being copied into
// every child ward (4.83 MB across the 189 AOIs). aoi.js must rehydrate BOTH
// tiers back to a `.geom` so the renderer/FocusPicker see an unchanged shape,
// and must fetch each shared file at most ONCE per session.
//
// A THIRD, different kind of ref: focusUnits.new_wards/old_wards used to
// embed the SAME polygon as boundaries.wards_new/wards_old, twice, in ONE
// file (~7.7 MB across the 189 AOIs — see tests/test_dedupe_ward_geom.py).
// Unlike geomRef, `boundaryRef` never fetches anything — it points at a list
// already sitting in THIS SAME parsed document.
import { describe, it, expect, beforeEach, vi } from "vitest";

const REGION_GEOM = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
const DIST_GEOM = { type: "Polygon", coordinates: [[[2, 2], [3, 2], [3, 3], [2, 2]]] };
const WARD_GEOM = { type: "Polygon", coordinates: [[[4, 4], [5, 4], [5, 5], [4, 4]]] };

function aoiDoc() {
  return {
    id: "phuong-x",
    focusUnits: {
      region: { id: "region-hcmc", name: "HCMC", center: [0, 0], bbox: [0, 0, 1, 1],
                geomRef: "region-hcmc" },
      districts: [
        { id: "huyen-dau-tieng", name: "Huyện Dầu Tiếng", center: [2, 2],
          bbox: [2, 2, 3, 3], geomRef: "district-huyen-dau-tieng" },
      ],
      new_wards: [
        { id: "phuong-y", name: "Phường Y", center: [4, 4], bbox: [4, 4, 5, 5],
          boundaryRef: { tier: "wards_new", name: "Phường Y" } },
      ],
      old_wards: [],
    },
    boundaries: {
      district: {},
      // boundaries.wards is an ALIAS of wards_new here (bake_aoi.assemble()):
      // it carries a boundaryRef instead of re-embedding the same polygon a
      // third time in this file.
      wards: [{ name: "Phường Y", boundaryRef: { tier: "wards_new", name: "Phường Y" } }],
      wards_new: [{ name: "Phường Y", geom: WARD_GEOM }],
      wards_old: [],
    },
  };
}

async function loadStore(fetchImpl) {
  global.window = {};
  global.fetch = fetchImpl;
  vi.resetModules();
  await import("../aoi.js?h=" + Math.random());
  return global.window.aoiStore;
}

describe("aoiStore shared-geometry hydration", () => {
  let calls;
  const routes = {
    "aoi/manifest.json": () => [{ id: "phuong-x" }],
    "aoi/phuong-x.json": aoiDoc,
    "aoi/region-hcmc.json": () => ({ id: "region-hcmc", name: "HCMC", geom: REGION_GEOM }),
    "aoi/district-huyen-dau-tieng.json": () => ({
      id: "huyen-dau-tieng", name: "Huyện Dầu Tiếng", geom: DIST_GEOM,
    }),
  };

  beforeEach(() => { calls = []; });

  const fetchImpl = (url) => {
    calls.push(url);
    const body = routes[url];
    return Promise.resolve({ json: () => Promise.resolve(body ? body() : null) });
  };

  it("hydrates a district geomRef into a real geometry", async () => {
    const store = await loadStore(fetchImpl);
    const cur = await store.select("phuong-x");
    const d = cur.focusUnits.districts[0];
    expect(d.geom).toEqual(DIST_GEOM);
    // and keeps its OWN metadata (the picker lists it without the geometry)
    expect(d.id).toBe("huyen-dau-tieng");
    expect(d.name).toBe("Huyện Dầu Tiếng");
    expect(d.bbox).toEqual([2, 2, 3, 3]);
  });

  it("still hydrates the region geomRef (the original dedupe)", async () => {
    const store = await loadStore(fetchImpl);
    const cur = await store.select("phuong-x");
    expect(cur.focusUnits.region.geom).toEqual(REGION_GEOM);
  });

  it("fetches each shared file at most once, even across AOI switches", async () => {
    const store = await loadStore(fetchImpl);
    await store.select("phuong-x");
    await store.select("phuong-x");   // same district => must NOT refetch
    const shared = calls.filter((u) => u.includes("district-") || u.includes("region-hcmc"));
    expect(shared).toHaveLength(2);   // one district + one region, total
  });

  it("survives a dangling ref instead of crashing the app", async () => {
    const store = await loadStore((url) => {
      calls.push(url);
      if (url === "aoi/district-huyen-dau-tieng.json") return Promise.reject(new Error("404"));
      const body = routes[url];
      return Promise.resolve({ json: () => Promise.resolve(body ? body() : null) });
    });
    const cur = await store.select("phuong-x");
    // the unit stays listable (metadata intact); it just has no geometry
    expect(cur.focusUnits.districts[0].name).toBe("Huyện Dầu Tiếng");
    expect(cur.focusUnits.districts[0].geom).toBeUndefined();
  });

  it("resolves a ward boundaryRef from THIS document's boundaries, with no fetch", async () => {
    const store = await loadStore(fetchImpl);
    const cur = await store.select("phuong-x");
    const w = cur.focusUnits.new_wards[0];
    expect(w.geom).toEqual(WARD_GEOM);
    expect(w.id).toBe("phuong-y");
    // no aoi/<something>.json fetch was made for the ward — only manifest + the
    // AOI doc itself + the district/region shared files
    const wardFetches = calls.filter((u) => u.includes("phuong-y"));
    expect(wardFetches).toHaveLength(0);
  });

  it("leaves a ward untouched when its boundaryRef does not resolve", async () => {
    const store = await loadStore(fetchImpl);
    const doc = aoiDoc();
    doc.focusUnits.old_wards = [
      { id: "phuong-z", name: "Phường Z", center: [6, 6], bbox: [6, 6, 7, 7],
        boundaryRef: { tier: "wards_old", name: "Phường Z" } },
    ];
    // no matching boundaries.wards_old entry -> stays a bare ref, no crash
    const routesWithBadRef = { ...routes, "aoi/phuong-x.json": () => doc };
    const store2 = await loadStore((url) => {
      calls.push(url);
      const body = routesWithBadRef[url];
      return Promise.resolve({ json: () => Promise.resolve(body ? body() : null) });
    });
    const cur = await store2.select("phuong-x");
    expect(cur.focusUnits.old_wards[0].geom).toBeUndefined();
    expect(cur.focusUnits.old_wards[0].name).toBe("Phường Z");
  });

  it("boundaryPolygon() resolves boundaries.wards' boundaryRef with no code change to boundaryPolygon", async () => {
    const store = await loadStore(fetchImpl);
    await store.select("phuong-x");
    store.selectBoundary("ward", "Phường Y");
    expect(store.boundaryPolygon()).toEqual(WARD_GEOM);
  });

  // Review Finding 2: a name-keyed ref is only safe when the name is UNIQUE.
  // The baker refuses to emit an ambiguous one (focus_units.dedupe_ward_geom),
  // but resolveBoundaryRef used to be a first-wins Array.find -- so a bad file
  // with two same-named wards would have silently served the WRONG twin's
  // polygon under this ward's name. Both sides must now refuse to guess.
  it("refuses an AMBIGUOUS boundaryRef rather than serving the wrong twin's geometry", async () => {
    const TWIN_A = { type: "Polygon", coordinates: [[[8, 8], [9, 8], [9, 9], [8, 8]]] };
    const TWIN_B = { type: "Polygon", coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]] };
    const doc = aoiDoc();
    // two DIFFERENT wards sharing one name -- the ref below cannot say which
    doc.boundaries.wards_new = [
      { name: "Phường Trùng Tên", geom: TWIN_A },
      { name: "Phường Trùng Tên", geom: TWIN_B },
    ];
    doc.focusUnits.new_wards = [
      { id: "phuong-trung-ten", name: "Phường Trùng Tên", center: [8, 8], bbox: [8, 8, 9, 9],
        boundaryRef: { tier: "wards_new", name: "Phường Trùng Tên" } },
    ];
    const store = await loadStore((url) => {
      calls.push(url);
      const body = url === "aoi/phuong-x.json" ? () => doc : routes[url];
      return Promise.resolve({ json: () => Promise.resolve(body ? body() : null) });
    });
    const cur = await store.select("phuong-x");
    const w = cur.focusUnits.new_wards[0];
    // NOT resolved to either twin -- absent beats wrong-but-plausible
    expect(w.geom).toBeUndefined();
    expect(w.geom).not.toEqual(TWIN_A);
    expect(w.geom).not.toEqual(TWIN_B);
    // and the unit is still listable in the picker
    expect(w.name).toBe("Phường Trùng Tên");
  });
});
