// web/aoi.js — loads the per-AOI baked data (aoi/manifest.json + aoi/<id>.json)
// and owns boundary/category selection state for the poster app.
window.aoiStore = (function () {
  let manifest = [], current = null, boundaryKind = "district", boundaryName = null;
  // Shared focus geometry, cached by ref id. Both the whole-region outline and each
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

  // Resolve a {boundaryRef} focus-unit ward: unlike geomRef (a SEPARATE shared
  // file, fetched over HTTP), boundaryRef points at a list already sitting a
  // few keys away in THIS SAME parsed document (obj.boundaries.wards_new /
  // wards_old) — the polygon `focusUnits.new_wards`/`old_wards` and
  // `boundaries.wards_new`/`wards_old` used to embed twice. No network round
  // trip: this is a plain in-memory lookup by ward name.
  //
  // A ref is resolved ONLY when the name matches EXACTLY ONE ward in the tier.
  // The baker already refuses to emit a ref for a duplicated name
  // (focus_units.dedupe_ward_geom), so an ambiguous ref should never ship —
  // but this used to be a first-wins `Array.find`, which silently serves the
  // WRONG twin's geometry if a bad file ever does. Both sides now refuse to
  // guess: an ambiguous ref leaves the unit alone (no geometry) rather than
  // rendering someone else's polygon under this ward's name. Wrong-but-
  // plausible is worse than absent.
  function resolveBoundaryRef(unit, boundaries) {
    if (!unit || unit.geom || !unit.boundaryRef) return unit;
    const list = (boundaries && boundaries[unit.boundaryRef.tier]) || [];
    const matches = list.filter(w => w.name === unit.boundaryRef.name);
    if (matches.length !== 1 || !matches[0].geom) return unit;
    return { ...unit, geom: matches[0].geom };
  }

  async function hydrateSharedFocusUnits(obj) {
    const fu = obj && obj.focusUnits;
    if (!fu) return obj;
    // region: a single unit (the whole city). districts: a list — each ward
    // references its parent district's outline instead of inlining it (39
    // distinct districts were being copied into all 189 AOI files = 4.83 MB
    // of duplication).
    const [region, districts] = await Promise.all([
      hydrateUnit(fu.region),
      Promise.all((fu.districts || []).map(hydrateUnit)),
    ]);
    if (fu.region) fu.region = region;
    if (fu.districts) fu.districts = districts;
    // new_wards/old_wards: resolved from THIS document's boundaries, not a
    // fetch — see resolveBoundaryRef.
    const boundaries = obj.boundaries || {};
    if (fu.new_wards) fu.new_wards = fu.new_wards.map(u => resolveBoundaryRef(u, boundaries));
    if (fu.old_wards) fu.old_wards = fu.old_wards.map(u => resolveBoundaryRef(u, boundaries));
    return obj;
  }

  // boundaries.wards is an alias of wards_old/wards_new (bake_aoi.assemble());
  // a ward that duplicates one of those lists byte-for-byte carries a
  // boundaryRef instead of its own `geom` (see bake_aoi.assemble). Resolve it
  // here too, same intra-document lookup, so boundaryPolygon() below can keep
  // reading `.geom` directly with no changes.
  function resolveBoundaryAliasList(obj) {
    const b = obj && obj.boundaries;
    if (!b || !Array.isArray(b.wards)) return obj;
    b.wards = b.wards.map(u => resolveBoundaryRef(u, b));
    return obj;
  }

  async function select(id) {
    current = await fetch(`aoi/${id}.json`).then(r => r.json());
    current = await hydrateSharedFocusUnits(current);
    current = resolveBoundaryAliasList(current);
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
  const categoryTree = () => (current && current.categoryTree) || [];

  return {
    load, select, selectBoundary, boundaryPolygon, buildingsFC, categoryTree,
    get manifest() { return manifest; },
    get current() { return current; },
  };
})();
