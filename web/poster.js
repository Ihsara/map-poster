// App wiring (Task 15: legacy #controls DOM panel removed — the Preact shell
// in web-src/ is the only UI now, driving this map through
// store.subscribeEffects + web-src/renderer.js). What remains here is the
// renderer's own bootstrap, which the shell depends on and does NOT
// replace:
//   - build a hand-authored OpenFreeMap style + init MapLibre with the
//     Bình Thạnh launch preset (pan-anywhere still works)
//   - window.posterState, kept current on "moveend" (renderer.js's
//     buildSnapshot reads posterState.center for export)
//   - boot window.aoiStore (load manifest + select the default AOI)
//   - the INITIAL fade + category-layer application on map "load" (and
//     again after any setStyle-driven style wipe). This can't be deleted
//     in favor of the shell's effects: main.jsx's subscribeEffects runs its
//     renderer.setStyle/selectBoundary effects once eagerly on subscribe,
//     but that eager run can race window.map / aoiStore.current not being
//     ready yet — the guarded no-op in renderer.js means it does NOT retry
//     once they become ready (no signal changes to re-trigger it), so the
//     first paint of the fade + categories still depends on this file's own
//     map.on("load")/styledata handlers.
// Removed: every #controls DOM element read/write (theme/layout/boundary/
// palette <select>s, city/country <input>s, the category-tree <fieldset>,
// #coverage/#attribution text, and the #export button's onclick) — that
// wiring is now owned by the Preact sections (ThemeSection, LayoutSection,
// PlacesSection, ExportBar) via the store + renderer.js. state.theme is
// still tracked here for the initial/style-driven fade+category calls, but
// nothing on this file mutates it after boot — the shell's own setStyle/
// updateCategories effects take over from the first user interaction.
const BINH_THANH = { center: [106.7162, 10.8121], zoom: 12.4, city: "Bình Thạnh", country: "Vietnam" };

async function boot() {
  const [themes, layouts] = await Promise.all([
    fetch("../data/themes.json").then(r => r.json()),
    fetch("../data/layouts.json").then(r => r.json()),
  ]);

  const state = window.posterState = {
    themeId: themes.defaultThemeId,
    theme: themes.themes[themes.defaultThemeId],
    layoutId: layouts.defaultLayoutId,
    center: BINH_THANH.center, zoom: BINH_THANH.zoom,
    city: BINH_THANH.city,
    country: BINH_THANH.country,
  };

  const map = window.map = new maplibregl.Map({
    container: "map",
    style: window.generateMapStyle(state.theme),
    center: state.center, zoom: state.zoom,
    attributionControl: false,
    preserveDrawingBuffer: true,
  });
  map.on("moveend", () => {
    const c = map.getCenter(); state.center = [c.lng, c.lat]; state.zoom = map.getZoom();
  });

  // Load the baked AOI (Bình Thạnh by default) and fade everything outside
  // its boundary once the map style is ready. Pan-anywhere still works — the
  // fade is just a layer on top; it doesn't restrict the base map.
  await window.aoiStore.load();
  if (window.aoiStore.manifest.length) {
    await window.aoiStore.select(window.aoiStore.manifest[0].id);
  }

  const store = window.aoiStore;
  state.paletteMode = "harmonized";
  state.selection = [];

  map.on("load", () => {
    const poly = window.aoiStore.boundaryPolygon();
    if (poly) window.applyBoundaryFade(map, poly, state.theme);
    if (store.current) {
      window.categoryLayer.ensure(map, store);
      window.categoryLayer.update(map, store, state.selection, state.paletteMode, state.theme);
    }
  });
}
boot();
