// web/aoi.js — loads the per-AOI baked data (aoi/manifest.json + aoi/<id>.json)
// and owns boundary/category selection state for the poster app.
window.aoiStore = (function () {
  let manifest = [], current = null, boundaryKind = "district", boundaryName = null;
  // Shared focus geometry, cached by ref id. Both the whole-region outline and each
  // parent-district outline are shared by many AOIs, so they are stored once under
  // web/aoi/<ref>.json and fetched at most once per session. Switching AOIs inside
  // the same district therefore costs no extra geometry fetch.
  const sharedGeomCache = new Map();
  // Same idea, for the AOI payload itself — see select() below.
  const aoiPayloadCache = new Map();

  async function load() {
    // ?v= is REQUIRED here, and it is easy to miss: manifest.json is the only
    // shipped asset that is NOT referenced from poster.html, so poster.html's
    // cache-bust cannot cover it. UX7 rewrote districtName on all 688 rows and
    // added provinceName. Without this bust, a RETURNING visitor gets the new
    // code against a cached OLD manifest — every row self-echoes, provinceName
    // is undefined, and the subtitle falls all the way back to "Việt Nam", the
    // exact bug this release removes. A cold-browser live gate cannot see it.
    // Bump this whenever the manifest is re-baked.
    manifest = await fetch("aoi/manifest.json?v=20260713ux7").then(r => r.json()).catch(() => []);
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

  // The page boots TWO apps against this one store — the frozen renderer
  // (poster.js) and the Preact panel (main.jsx) — and both select the boot AOI.
  // Measured live: they each fetched aoi/binh-thanh.json, 225 KB, twice. Cache
  // the PAYLOAD promise per id (like sharedFocusUnit above) so concurrent
  // callers share one in-flight request. Only the raw payload is cached: the
  // hydrate/resolve steps below mutate their object and assign module state, so
  // they must still run per call.
  async function select(id) {
    if (!aoiPayloadCache.has(id)) {
      // Evict on failure, or a single transient blip would poison this AOI for
      // the page's lifetime: the rejected promise would stay cached and every
      // later select(id) would re-reject with no retry path. (load() and
      // sharedFocusUnit() above both guard their fetches; this must too.)
      aoiPayloadCache.set(
        id,
        fetch(`aoi/${id}.json`).then(r => r.json()).catch(err => {
          aoiPayloadCache.delete(id);
          throw err;
        })
      );
    }
    current = await aoiPayloadCache.get(id);
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
  // Every consumer of a category colour reads the tree through here — the map
  // layer (category_layer.js) and the picker's swatches (PlacesPicker.jsx) —
  // so this is where the palette gets told the REAL domain order.
  //
  // palettes.js carries a hardcoded 16-name DOMAINS table that predates the
  // Overture taxonomy this data now uses: only 3 of the 13 live domain ids are
  // in it, so the rest fell through to a hash and COLLIDED — 13 categories
  // rendered in 7 colours, food_and_drink and cultural_and_historic identical.
  // Registering it here (rather than inside the map layer's update()) means the
  // map and the picker's swatches cannot disagree, and it holds even when the
  // categories layer is switched off.
  const categoryTree = () => {
    const tree = (current && current.categoryTree) || [];
    if (window.palettes && window.palettes.setDomainOrder) {
      window.palettes.setDomainOrder(tree.map(d => d.id));
    }
    return tree;
  };

  return {
    load, select, selectBoundary, boundaryPolygon, buildingsFC, categoryTree,
    get manifest() { return manifest; },
    get current() { return current; },
  };
})();
