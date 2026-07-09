// basemapProvider — the ONLY place tile source + attribution live.
// OpenFreeMap: free, KEYLESS OpenMapTiles-schema vector tiles. No API key, no
// domain-lock — so the published static site needs no secret. The MapLibre style
// is hand-authored in maplibre_style.js (generateMapStyle) against this source;
// we do NOT fetch a vendor style URL.
(function () {
  const openfreemap = {
    id: "openfreemap",
    tileUrl() { return "https://tiles.openfreemap.org/planet"; },
    attribution() { return "© OpenStreetMap contributors"; },
  };
  window.basemapProvider = openfreemap;
})();
