// web/aoi.js — loads the per-AOI baked data (aoi/manifest.json + aoi/<id>.json)
// and owns boundary/category selection state for the poster app.
window.aoiStore = (function () {
  let manifest = [], current = null, boundaryKind = "district", boundaryName = null;

  async function load() {
    manifest = await fetch("aoi/manifest.json").then(r => r.json()).catch(() => []);
  }

  async function select(id) {
    current = await fetch(`aoi/${id}.json`).then(r => r.json());
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
