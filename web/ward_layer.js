// web/ward_layer.js — Task 14: ward BORDER (dashed line) + LABEL (symbol) +
// optional area-choropleth FILL layers, driven by the Wards sub-screen
// (web-src/subscreens/WardsPicker.jsx via web-src/store.js's wardLayer
// effect -> web-src/renderer.js#wardLayer).
//
// A NEW file rather than growing boundary_mask.js: boundary_mask.js owns the
// single-polygon spotlight/fade (district OR one selected ward), while this
// module draws the WHOLE ward SET (old or new) as its own line/symbol/fill
// layer set, an orthogonal concern with its own toggle set (borders/fill/
// labels) — keeping them separate files avoids overloading one module with
// two independent jobs (task-14-brief.md approves either approach; this is
// the "prefer a new file" branch it calls cleaner).
//
// Ward geometry is HONESTLY EMPTY right now (Task 13 baked the shape but OSM
// has no usable ward polygons for Bình Thạnh at any admin level — 2025 reorg
// gap). render() below is correct against an empty `wards` array: it clears
// its layers/sources and no-ops, so this renders NOTHING today but is wired
// exactly as it needs to be for when real ward polygons land — no future
// rewrite required, only baked data changing shape from [] to populated.
(function () {
  const LINE_SRC = "ward-lines", LINE_LAYER = "ward-lines-layer";
  const FILL_SRC = "ward-fills", FILL_LAYER = "ward-fills-layer";
  const LABEL_SRC = "ward-labels", LABEL_LAYER = "ward-labels-layer";

  // Flatten a Polygon/MultiPolygon geometry (or a Feature wrapping one) into
  // an array of its outer+hole rings — same shape boundary_mask.js#ringsOf
  // expects, duplicated here (not imported — this is a plain <script>, no
  // module system) rather than reaching into boundary_mask.js's IIFE scope.
  function geometryOf(g) {
    if (!g) return null;
    return g.type === "Feature" ? g.geometry : g;
  }

  // A rough polygon-area proxy (shoelace formula in degrees^2, NOT a true
  // geodesic area) — good enough to rank wards relative to each other for
  // the optional choropleth fill; exact area is not the point here.
  function ringArea(ring) {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  }

  function polygonArea(geometry) {
    if (!geometry) return 0;
    if (geometry.type === "Polygon") return ringArea(geometry.coordinates[0] || []);
    if (geometry.type === "MultiPolygon") {
      return geometry.coordinates.reduce((sum, poly) => sum + ringArea(poly[0] || []), 0);
    }
    return 0;
  }

  // Representative point for a label anchor — vertex-average centroid
  // (matches boundary_mask.js's centroid approximation strategy; exact
  // point-in-polygon centroid is not needed for a label anchor).
  function labelPoint(geometry) {
    const rings =
      geometry.type === "Polygon"
        ? [geometry.coordinates[0] || []]
        : geometry.type === "MultiPolygon"
        ? geometry.coordinates.map((p) => p[0] || [])
        : [];
    let sx = 0, sy = 0, n = 0;
    for (const ring of rings) {
      for (const [x, y] of ring) { sx += x; sy += y; n++; }
    }
    return n ? [sx / n, sy / n] : [0, 0];
  }

  // Resolve the label text for one ward given the current label mode.
  // The four modes are DISTINCT (task-14 review fix #1):
  //  - "off"     -> no label
  //  - "auto"    -> number for numbered (old) wards, name for named (new)
  //  - "names"   -> always the name (forced)
  //  - "numbers" -> always the number (forced) — even for a non-numbered
  //                 (New·named) ward, which genuinely has no number, so it
  //                 falls back to an em dash "—" rather than silently showing
  //                 the name (which would make "Numbers" indistinguishable
  //                 from "Auto" for named wards).
  // Mirrors WardsPicker.jsx's wardLabelText so the sub-screen's ward list
  // preview and the map's SYMBOL layer always agree.
  function labelText(ward, labels) {
    if (labels === "off") return null;
    if (labels === "names") return ward.name;
    if (labels === "numbers") return ward.number != null ? String(ward.number) : "—";
    return ward.numbered ? String(ward.number) : ward.name; // auto
  }

  function clearLayer(map, layerId, srcId) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(srcId)) map.removeSource(srcId);
  }

  window.wardLayer = {
    // render(map, wards, opts): wards = array of {name, number, numbered,
    // geom} (wards_old or wards_new — see task-13/14 briefs); opts =
    // {showBorders, labels, fillByArea, theme}. vintage="district" or an
    // empty wards array is a valid, EXPECTED input (today's real bake) —
    // both simply clear the layers so nothing fake is drawn.
    render(map, wards, opts) {
      if (!map || !map.getStyle) return;
      opts = opts || {};
      const list = Array.isArray(wards) ? wards.filter((w) => w && w.geom) : [];

      if (list.length === 0) {
        clearLayer(map, LINE_LAYER, LINE_SRC);
        clearLayer(map, FILL_LAYER, FILL_SRC);
        clearLayer(map, LABEL_LAYER, LABEL_SRC);
        return;
      }

      const theme = opts.theme || {};
      const lineColor = (theme.ui && theme.ui.text) || "#333";
      const textColor = (theme.ui && theme.ui.text) || "#222";

      // --- borders (dashed LINE) -------------------------------------
      const lineFC = {
        type: "FeatureCollection",
        features: list.map((w) => ({ type: "Feature", properties: {}, geometry: geometryOf(w.geom) })),
      };
      if (opts.showBorders) {
        if (map.getSource(LINE_SRC)) map.getSource(LINE_SRC).setData(lineFC);
        else map.addSource(LINE_SRC, { type: "geojson", data: lineFC });

        if (!map.getLayer(LINE_LAYER)) {
          map.addLayer({
            id: LINE_LAYER, type: "line", source: LINE_SRC,
            paint: { "line-color": lineColor, "line-width": 1, "line-dasharray": [2, 2], "line-opacity": 0.8 },
          });
        } else {
          map.setPaintProperty(LINE_LAYER, "line-color", lineColor);
        }
      } else {
        clearLayer(map, LINE_LAYER, LINE_SRC);
      }

      // --- optional area choropleth FILL (off by default) -------------
      if (opts.fillByArea) {
        const areas = list.map((w) => polygonArea(geometryOf(w.geom)));
        const maxArea = Math.max(...areas, 1e-9);
        const fillFC = {
          type: "FeatureCollection",
          features: list.map((w, i) => ({
            type: "Feature",
            properties: { t: areas[i] / maxArea },
            geometry: geometryOf(w.geom),
          })),
        };
        if (map.getSource(FILL_SRC)) map.getSource(FILL_SRC).setData(fillFC);
        else map.addSource(FILL_SRC, { type: "geojson", data: fillFC });

        if (!map.getLayer(FILL_LAYER)) {
          map.addLayer(
            {
              id: FILL_LAYER, type: "fill", source: FILL_SRC,
              paint: {
                "fill-color": lineColor,
                "fill-opacity": ["interpolate", ["linear"], ["get", "t"], 0, 0.08, 1, 0.35],
              },
            },
            map.getLayer(LINE_LAYER) ? LINE_LAYER : undefined
          );
        }
      } else {
        clearLayer(map, FILL_LAYER, FILL_SRC);
      }

      // --- labels (SYMBOL, text-field) ---------------------------------
      // text-field reads the baked `label` property below — MapLibre's
      // symbol renderer shapes/positions Unicode text (incl. Vietnamese
      // diacritics) via its own text layout engine, the same path every
      // other label in this app's basemap style already uses
      // (maplibre_style.js), so VN ward names (once baked) render with the
      // same diacritic fidelity as street/POI labels already verified
      // elsewhere in this project.
      if (opts.labels && opts.labels !== "off") {
        const labelFC = {
          type: "FeatureCollection",
          features: list
            .map((w) => ({ w, text: labelText(w, opts.labels) }))
            .filter((e) => e.text)
            .map((e) => ({
              type: "Feature",
              properties: { label: e.text },
              geometry: { type: "Point", coordinates: labelPoint(geometryOf(e.w.geom)) },
            })),
        };
        if (map.getSource(LABEL_SRC)) map.getSource(LABEL_SRC).setData(labelFC);
        else map.addSource(LABEL_SRC, { type: "geojson", data: labelFC });

        if (!map.getLayer(LABEL_LAYER)) {
          map.addLayer({
            id: LABEL_LAYER, type: "symbol", source: LABEL_SRC,
            layout: {
              "text-field": ["get", "label"],
              "text-size": 12,
              "text-font": ["Noto Sans Regular"],
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": textColor,
              "text-halo-color": "#fff",
              "text-halo-width": 1.2,
            },
          });
        } else {
          map.setPaintProperty(LABEL_LAYER, "text-color", textColor);
        }
      } else {
        clearLayer(map, LABEL_LAYER, LABEL_SRC);
      }
    },

    // clear(map): drop all three layers/sources — used when vintage goes
    // back to "district" (no ward set to draw).
    clear(map) {
      if (!map || !map.getStyle) return;
      clearLayer(map, LINE_LAYER, LINE_SRC);
      clearLayer(map, FILL_LAYER, FILL_SRC);
      clearLayer(map, LABEL_LAYER, LABEL_SRC);
    },
  };
})();
