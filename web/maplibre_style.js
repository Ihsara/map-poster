/*
 * maplibre_style.js — hand-authored MapLibre-GL style for the map-poster app.
 *
 * Original code, written from a distilled design spec (numeric stops, class
 * buckets, render order). Targets keyless OpenFreeMap vector tiles served in
 * the OpenMapTiles schema. Exposes:
 *   window.generateMapStyle(theme, opts) -> MapLibre StyleSpecification (v8)
 *   window._roadClasses                  -> the class->level bucket map
 *
 * A poster basemap wants a steep road hierarchy: a couple of heroic arterials,
 * everything else fading to a hairline. We build that with per-level width and
 * opacity ramps, casing lines drawn under their fills, and low-zoom "overview"
 * lines that hand off to detail lines around z12.
 */
(function () {
  "use strict";

  // ---- Road class -> hierarchy level -------------------------------------
  // Six buckets. `major` is the hero road; `minor_high/mid/low` step down; a
  // `path` bucket for footways/tracks; `rail` for railways/transit lines.
  var ROAD_CLASSES = {
    major: ["motorway"],
    minor_high: [
      "primary", "primary_link",
      "secondary", "secondary_link",
      "motorway_link",
      "trunk", "trunk_link",
    ],
    minor_mid: ["tertiary", "tertiary_link", "minor"],
    minor_low: [
      "residential", "living_street", "unclassified",
      "road", "street", "street_limited", "service",
    ],
    path: ["path", "pedestrian", "cycleway", "track"],
    rail: ["rail", "transit"],
  };

  var WATERWAY_CLASSES = ["river", "canal", "stream", "ditch"];

  // ---- Width ramps ([zoom, width] pairs) ---------------------------------
  var WIDTH = {
    majorDetail: [[0, 0.36], [3, 0.52], [9, 1.1], [14, 2.05], [18, 3.3]],

    minorHighDetail: [[6, 0.46], [10, 0.8], [14, 1.48], [18, 2.7]],
    minorHighOverview: [[0, 0.1], [4, 0.18], [8, 0.3], [11, 0.46]],

    minorMidDetail: [[6, 0.34], [10, 0.62], [14, 1.2], [18, 2.35]],
    minorMidOverview: [[0, 0.08], [4, 0.14], [8, 0.24], [11, 0.36]],

    minorLowDetail: [[6, 0.24], [10, 0.44], [14, 0.84], [18, 1.65]],
    minorLowOverview: [[0, 0.06], [4, 0.1], [8, 0.18], [11, 0.3]],

    pathDetail: [[8, 0.2], [12, 0.42], [16, 0.85], [18, 1.3]],
    pathOverview: [[5, 0.06], [8, 0.1], [11, 0.2]],

    waterway: [[0, 0.2], [6, 0.34], [12, 0.8], [18, 2.4]],
    rail: [[3, 0.4], [6, 0.7], [10, 1], [18, 1.5]],
  };

  // Casing multipliers: how much wider the outline is than its fill.
  var CASING = {
    major: 1.38,
    minorHigh: 1.45,
    minorMid: 1.15,
    path: 1.6,
  };

  // ---- Opacity ramps -----------------------------------------------------
  var OPACITY = {
    overviewHigh: [[0, 0.66], [8, 0.76], [12, 0]],
    overviewMid: [[0, 0.46], [8, 0.56], [12, 0]],
    overviewLow: [[0, 0.26], [8, 0.34], [12, 0]],
    pathOverview: [[5, 0.45], [9, 0.58], [12, 0]],

    detailHigh: [[6, 0.84], [10, 0.92], [18, 1]],
    detailMid: [[6, 0.62], [10, 0.74], [18, 0.86]],
    detailLow: [[6, 0.34], [10, 0.46], [18, 0.58]],
    detailPath: [[8, 0.7], [12, 0.82], [18, 0.95]],

    casingMinorHigh: [[6, 0.72], [12, 0.85], [18, 0.92]],
    casingMinorMid: [[6, 0.42], [12, 0.56], [18, 0.66]],
    casingPath: [[8, 0.62], [12, 0.72], [18, 0.85]],

    rail: [[0, 0.56], [12, 0.62], [18, 0.72]],
  };

  var CASING_MAJOR_OPACITY = 0.95;
  var LANDCOVER_OPACITY = 0.7;
  var AEROWAY_OPACITY = 0.85;
  var BUILDING_OPACITY = 0.84;
  var RAIL_DASHARRAY = [2, 1.6];
  var OVERVIEW_MAXZOOM = 11.8;
  var BUILDING_MINZOOM = 8;

  // ---- Expression helpers ------------------------------------------------

  // Turn [[z,v],...] pairs into a MapLibre linear interpolate expression.
  function interp(stops) {
    var expr = ["interpolate", ["linear"], ["zoom"]];
    for (var i = 0; i < stops.length; i++) {
      expr.push(stops[i][0], stops[i][1]);
    }
    return expr;
  }

  var widthExpr = interp; // width and opacity share the interpolate shape
  var opacityExpr = interp;

  // Multiply every width value in a stop set by k (used for casings).
  function scaled(stops, k) {
    return stops.map(function (pair) {
      return [pair[0], pair[1] * k];
    });
  }

  // Filter: LineString geometry AND class in the given set.
  function lineClassFilter(classes) {
    return [
      "all",
      ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
      ["match", ["get", "class"], classes, true, false],
    ];
  }

  // Filter: polygon geometry (aeroway is drawn as a fill).
  function polygonFilter() {
    return ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
  }

  // Resolve an include* flag to a default of true.
  function on(opts, key) {
    return opts[key] !== false;
  }

  function vis(flag) {
    return { visibility: flag ? "visible" : "none" };
  }

  var LINE_LAYOUT_BASE = { "line-cap": "round", "line-join": "round" };

  function lineLayout(flag) {
    return Object.assign({}, LINE_LAYOUT_BASE, vis(flag));
  }

  // ---- Style assembly ----------------------------------------------------
  function generateMapStyle(theme, opts) {
    opts = opts || {};
    var map = theme.map;
    var roads = map.roads;

    var showLandcover = on(opts, "includeLandcover");
    var showBuildings = on(opts, "includeBuildings");
    var showWater = on(opts, "includeWater");
    var showParks = on(opts, "includeParks");
    var showAeroway = on(opts, "includeAeroway");
    var showRail = on(opts, "includeRail");
    var showRoads = on(opts, "includeRoads");
    var showRoadPath = on(opts, "includeRoadPath");
    var showRoadMinorLow = on(opts, "includeRoadMinorLow");
    var showRoadOutline = on(opts, "includeRoadOutline");

    // Sub-toggles that suppress a level by zeroing opacity rather than hiding
    // the whole layer (keeps the layer present so framing/toggling stays stable).
    function pathOpacity(stops) {
      return showRoadPath ? opacityExpr(stops) : 0;
    }
    function minorLowOpacity(stops) {
      return showRoadMinorLow ? opacityExpr(stops) : 0;
    }

    var layers = [];

    // background (land)
    layers.push({
      id: "background",
      type: "background",
      paint: { "background-color": map.land },
    });

    // landcover fill
    layers.push({
      id: "landcover",
      type: "fill",
      source: "ofm",
      "source-layer": "landcover",
      layout: vis(showLandcover),
      paint: {
        "fill-color": map.landcover || map.land,
        "fill-opacity": LANDCOVER_OPACITY,
      },
    });

    // park fill
    layers.push({
      id: "park",
      type: "fill",
      source: "ofm",
      "source-layer": "park",
      layout: vis(showParks),
      paint: { "fill-color": map.parks },
    });

    // water fill
    layers.push({
      id: "water",
      type: "fill",
      source: "ofm",
      "source-layer": "water",
      layout: vis(showWater),
      paint: { "fill-color": map.water },
    });

    // waterway line
    layers.push({
      id: "waterway",
      type: "line",
      source: "ofm",
      "source-layer": "waterway",
      filter: lineClassFilter(WATERWAY_CLASSES),
      layout: lineLayout(showWater),
      paint: {
        "line-color": map.waterway,
        "line-width": widthExpr(WIDTH.waterway),
      },
    });

    // aeroway fill (polygon)
    layers.push({
      id: "aeroway",
      type: "fill",
      source: "ofm",
      "source-layer": "aeroway",
      filter: polygonFilter(),
      layout: vis(showAeroway),
      paint: {
        "fill-color": map.aeroway,
        "fill-opacity": AEROWAY_OPACITY,
      },
    });

    // building fill (minzoom 8)
    layers.push({
      id: "building",
      type: "fill",
      source: "ofm",
      "source-layer": "building",
      minzoom: BUILDING_MINZOOM,
      layout: vis(showBuildings),
      paint: {
        "fill-color": map.buildings,
        "fill-opacity": BUILDING_OPACITY,
      },
    });

    // rail line (dashed, low alpha)
    layers.push({
      id: "rail",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.rail),
      layout: lineLayout(showRail),
      paint: {
        "line-color": map.rail,
        "line-width": widthExpr(WIDTH.rail),
        "line-opacity": opacityExpr(OPACITY.rail),
        "line-dasharray": RAIL_DASHARRAY,
      },
    });

    // ---- Low-zoom "overview" lines (fade out by z12) ---------------------
    // These carry the road network at zoomed-out poster framings and hand off
    // to the detail lines below. They live 0..OVERVIEW_MAXZOOM.
    layers.push({
      id: "road-minor-high-overview",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom: 0,
      maxzoom: OVERVIEW_MAXZOOM,
      filter: lineClassFilter(ROAD_CLASSES.minor_high),
      layout: lineLayout(showRoads),
      paint: {
        "line-color": roads.minor_high,
        "line-width": widthExpr(WIDTH.minorHighOverview),
        "line-opacity": opacityExpr(OPACITY.overviewHigh),
      },
    });
    layers.push({
      id: "road-minor-mid-overview",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom: 0,
      maxzoom: OVERVIEW_MAXZOOM,
      filter: lineClassFilter(ROAD_CLASSES.minor_mid),
      layout: lineLayout(showRoads),
      paint: {
        "line-color": roads.minor_mid,
        "line-width": widthExpr(WIDTH.minorMidOverview),
        "line-opacity": opacityExpr(OPACITY.overviewMid),
      },
    });
    layers.push({
      id: "road-minor-low-overview",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom: 0,
      maxzoom: OVERVIEW_MAXZOOM,
      filter: lineClassFilter(ROAD_CLASSES.minor_low),
      layout: lineLayout(showRoads),
      paint: {
        "line-color": roads.minor_low,
        "line-width": widthExpr(WIDTH.minorLowOverview),
        "line-opacity": minorLowOpacity(OPACITY.overviewLow),
      },
    });

    // path overview line
    layers.push({
      id: "road-path-overview",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      minzoom: 0,
      maxzoom: OVERVIEW_MAXZOOM,
      filter: lineClassFilter(ROAD_CLASSES.path),
      layout: lineLayout(showRoads),
      paint: {
        "line-color": roads.path,
        "line-width": widthExpr(WIDTH.pathOverview),
        "line-opacity": pathOpacity(OPACITY.pathOverview),
      },
    });

    // ---- Casing lines (drawn under fills; colored roads.outline) ---------
    layers.push({
      id: "road-major-casing",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.major),
      layout: lineLayout(showRoads && showRoadOutline),
      paint: {
        "line-color": roads.outline,
        "line-width": widthExpr(scaled(WIDTH.majorDetail, CASING.major)),
        "line-opacity": CASING_MAJOR_OPACITY,
      },
    });
    layers.push({
      id: "road-minor-high-casing",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.minor_high),
      layout: lineLayout(showRoads && showRoadOutline),
      paint: {
        "line-color": roads.outline,
        "line-width": widthExpr(scaled(WIDTH.minorHighDetail, CASING.minorHigh)),
        "line-opacity": opacityExpr(OPACITY.casingMinorHigh),
      },
    });
    layers.push({
      id: "road-minor-mid-casing",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.minor_mid),
      layout: lineLayout(showRoads && showRoadOutline),
      paint: {
        "line-color": roads.outline,
        "line-width": widthExpr(scaled(WIDTH.minorMidDetail, CASING.minorMid)),
        "line-opacity": opacityExpr(OPACITY.casingMinorMid),
      },
    });
    layers.push({
      id: "road-path-casing",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.path),
      layout: lineLayout(showRoads && showRoadOutline && showRoadPath),
      paint: {
        "line-color": roads.outline,
        "line-width": widthExpr(scaled(WIDTH.pathDetail, CASING.path)),
        "line-opacity": pathOpacity(OPACITY.casingPath),
      },
    });

    // ---- Road fills (major -> minor-high -> minor-mid -> minor-low -> path)
    layers.push({
      id: "road-major",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.major),
      layout: lineLayout(showRoads),
      paint: {
        "line-color": roads.major,
        "line-width": widthExpr(WIDTH.majorDetail),
      },
    });
    layers.push({
      id: "road-minor-high",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.minor_high),
      layout: lineLayout(showRoads),
      paint: {
        "line-color": roads.minor_high,
        "line-width": widthExpr(WIDTH.minorHighDetail),
        "line-opacity": opacityExpr(OPACITY.detailHigh),
      },
    });
    layers.push({
      id: "road-minor-mid",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.minor_mid),
      layout: lineLayout(showRoads),
      paint: {
        "line-color": roads.minor_mid,
        "line-width": widthExpr(WIDTH.minorMidDetail),
        "line-opacity": opacityExpr(OPACITY.detailMid),
      },
    });
    layers.push({
      id: "road-minor-low",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.minor_low),
      layout: lineLayout(showRoads),
      paint: {
        "line-color": roads.minor_low,
        "line-width": widthExpr(WIDTH.minorLowDetail),
        "line-opacity": minorLowOpacity(OPACITY.detailLow),
      },
    });
    layers.push({
      id: "road-path",
      type: "line",
      source: "ofm",
      "source-layer": "transportation",
      filter: lineClassFilter(ROAD_CLASSES.path),
      layout: lineLayout(showRoads),
      paint: {
        "line-color": roads.path,
        "line-width": widthExpr(WIDTH.pathDetail),
        "line-opacity": pathOpacity(OPACITY.detailPath),
      },
    });

    return {
      version: 8,
      sources: {
        ofm: {
          type: "vector",
          url: window.basemapProvider.tileUrl(),
          maxzoom: 14,
        },
      },
      layers: layers,
    };
  }

  window.generateMapStyle = generateMapStyle;
  window._roadClasses = ROAD_CLASSES;

  // --- Task 8 sanctioned pure addition: window.setLayerVisibility --------
  // A NEW, additive hook — does not modify generateMapStyle or ROAD_CLASSES.
  // Toggles ONLY the `visibility` layout property of the layers belonging to
  // each group (never colours/weights/paint). `layers` is a plain object of
  // {water, roads, buildings, green, rail, aeroway} booleans (Task 8's store
  // `layers` signal). Layer ids are matched against the actual ids emitted
  // by generateMapStyle above (verified: "water"/"waterway", "park"/
  // "landcover", "building", "rail", "aeroway", and every "road-*" layer
  // matched by id-prefix so new road layers stay covered automatically).
  var LAYER_GROUPS = {
    water: ["water", "waterway"],
    buildings: ["building"],
    green: ["park", "landcover"],
    rail: ["rail"],
    aeroway: ["aeroway"],
  };

  function setLayerVisibility(map, layers) {
    if (!map || !layers) return;
    var style = map.getStyle && map.getStyle();
    var allIds = (style && style.layers ? style.layers : []).map(function (l) {
      return l.id;
    });

    function applyTo(id, visible) {
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }

    Object.keys(LAYER_GROUPS).forEach(function (key) {
      if (!(key in layers)) return;
      var visible = !!layers[key];
      LAYER_GROUPS[key].forEach(function (id) {
        applyTo(id, visible);
      });
    });

    if ("roads" in layers) {
      var roadsVisible = !!layers.roads;
      allIds
        .filter(function (id) {
          return id.indexOf("road-") === 0;
        })
        .forEach(function (id) {
          applyTo(id, roadsVisible);
        });
    }
  }

  window.setLayerVisibility = setLayerVisibility;
})();
