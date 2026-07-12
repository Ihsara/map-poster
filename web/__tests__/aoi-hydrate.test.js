// web/__tests__/aoi-hydrate.test.js
//
// focusUnits carries SHARED geometry by reference, never inline:
//   - focusUnits.hcmc      -> geomRef "hcmc-region"      (1 shared file)
//   - focusUnits.districts -> geomRef "district-<id>"    (39 shared files)
// The second tier is the fix for parent-district outlines being copied into
// every child ward (4.83 MB across the 189 AOIs). aoi.js must rehydrate BOTH
// tiers back to a `.geom` so the renderer/FocusPicker see an unchanged shape,
// and must fetch each shared file at most ONCE per session.
import { describe, it, expect, beforeEach, vi } from "vitest";

const HCMC_GEOM = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
const DIST_GEOM = { type: "Polygon", coordinates: [[[2, 2], [3, 2], [3, 3], [2, 2]]] };

function aoiDoc() {
  return {
    id: "phuong-x",
    focusUnits: {
      hcmc: { id: "hcmc", name: "HCMC", center: [0, 0], bbox: [0, 0, 1, 1],
              geomRef: "hcmc-region" },
      districts: [
        { id: "huyen-dau-tieng", name: "Huyện Dầu Tiếng", center: [2, 2],
          bbox: [2, 2, 3, 3], geomRef: "district-huyen-dau-tieng" },
      ],
      new_wards: [], old_wards: [],
    },
    boundaries: { district: {}, wards: [] },
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
    "aoi/hcmc-region.json": () => ({ id: "hcmc", name: "HCMC", geom: HCMC_GEOM }),
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

  it("still hydrates the hcmc geomRef (the original dedupe)", async () => {
    const store = await loadStore(fetchImpl);
    const cur = await store.select("phuong-x");
    expect(cur.focusUnits.hcmc.geom).toEqual(HCMC_GEOM);
  });

  it("fetches each shared file at most once, even across AOI switches", async () => {
    const store = await loadStore(fetchImpl);
    await store.select("phuong-x");
    await store.select("phuong-x");   // same district => must NOT refetch
    const shared = calls.filter((u) => u.includes("district-") || u.includes("hcmc-region"));
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
});
