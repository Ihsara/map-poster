// web/aoi.js — loads the per-AOI baked data (aoi/manifest.json + aoi/<id>.json)
// and owns boundary/category selection state for the poster app.
window.aoiStore = (function () {
  let manifest = [], current = null, boundaryKind = "district", boundaryName = null;
  // Shared focus geometry, cached by ref id. Both the whole-HCMC outline and each
  // parent-district outline are shared by many AOIs, so they are stored once under
  // web/aoi/<ref>.json and fetched at most once per session. Switching AOIs inside
  // the same district therefore costs no extra geometry fetch.
  const sharedGeomCache = new Map();

  async function load() {
    manifest = await fetch("aoi/manifest.json").then(r => r.json()).catch(() => []);
  }

  async function sharedFocusUnit(ref) {
    if (!ref) return null;
    if (!sharedGeomCache.has(ref)) {
      sharedGeomCache.set(
        ref,
        fetch(`aoi/${ref}.json`).then(r => r.json()).catch(() => null)
      );
    }
    return sharedGeomCache.get(ref);   // a promise — dedupes concurrent hits
  }

  // Replace every {geomRef} focus unit with the real geometry. A unit keeps its
  // own metadata (id/name/center/bbox) and only borrows `geom` from the shared
  // file, so the runtime shape the renderer/picker see is unchanged.
  async function hydrateUnit(unit) {
    if (!unit || unit.geom || !unit.geomRef) return unit;
    const shared = await sharedFocusUnit(unit.geomRef);
    if (!shared || !shared.geom) return unit;
    return { ...shared, ...unit, geom: shared.geom };
  }

  async function hydrateSharedFocusUnits(obj) {
    const fu = obj && obj.focusUnits;
    if (!fu) return obj;
    // hcmc: a single unit. districts: a list — each ward references its parent
    // district's outline instead of inlining it (39 distinct districts were
    // being copied into all 189 AOI files = 4.83 MB of duplication).
    const [hcmc, districts] = await Promise.all([
      hydrateUnit(fu.hcmc),
      Promise.all((fu.districts || []).map(hydrateUnit)),
    ]);
    if (fu.hcmc) fu.hcmc = hcmc;
    if (fu.districts) fu.districts = districts;
    return obj;
  }

  async function select(id) {
    current = await fetch(`aoi/${id}.json`).then(r => r.json());
    current = await hydrateSharedFocusUnits(current);
    boundaryKind = "district"; boundaryName = null;
    return current;
  }

  function selectBoundary(kind, name) { boundaryKind = kind; boundaryName = name || null; }

  function boundaryPolygon() {
    if (!current) return null;
    if (boundaryKind === "ward" && boundaryName) {
      const w = (current.boundaries.wards || []).find(w => w.name === boundaryName);
      if (w) return w.geom;
    }
    return current.boundaries.district;
  }

  const buildingsFC = () => current && current.buildings;
  const buildingCat = () => (current && current.buildingCat) || {};
  const categoryTree = () => (current && current.categoryTree) || [];

  return {
    load, select, selectBoundary, boundaryPolygon, buildingsFC, buildingCat, categoryTree,
    get manifest() { return manifest; },
    get current() { return current; },
  };
})();
