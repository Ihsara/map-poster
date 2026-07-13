// Poster furniture: a 25/25 land-color fade top+bottom, plus a low, centered
// text block (city / rule / country / coordinates) drawn onto a 2D context.
// Default fonts (loaded via poster.html <link>): Alegreya (display), Lora
// (country), Be Vietnam Pro (VN-safe coords + attribution) — overridable
// per-call via o.fonts (Task 7, see drawPosterText below).
(function () {
  // Parse a #rgb / #rrggbb land hex into an rgba() string at the given alpha.
  function hexToRgba(hex, alpha) {
    let h = String(hex || "").trim().replace(/^#/, "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    if (!isFinite(n)) return `rgba(255,255,255,${alpha})`;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Sign-aware DMS-free coordinate string, e.g. "10.8121° N / 106.7162° E".
  function formatCoordinates(lat, lon) {
    return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"} / ` +
           `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
  }

  // Top + bottom land-color gradients: each fades the theme land from full
  // opacity at the frame edge to transparent 25% of the way in, seating the
  // map raster against the ground so the poster reads like a plate, not a screenshot.
  function applyFades(ctx, W, H, land) {
    const band = H * 0.25;
    ctx.save();

    // top: opaque at y=0, transparent at y=band
    const top = ctx.createLinearGradient(0, 0, 0, band);
    top.addColorStop(0, hexToRgba(land, 1));
    top.addColorStop(1, hexToRgba(land, 0));
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, band);

    // bottom: transparent at y=H*0.75, opaque at y=H
    const bottom = ctx.createLinearGradient(0, H, 0, H * 0.75);
    bottom.addColorStop(0, hexToRgba(land, 1));
    bottom.addColorStop(1, hexToRgba(land, 0));
    ctx.fillStyle = bottom;
    ctx.fillRect(0, H * 0.75, W, band);

    ctx.restore();
  }

  // The centered, low-seated text block plus corner credits.
  //   o = { width, height, theme, center:{lat,lon}, city, country,
  //         showCredits=true, attribution, fonts, titleSizeScale }
  //
  // Task 7 sanctioned font-routing touch-point (2 of 2 — see web/export.js
  // for the other): this function used to hardcode "Alegreya" / "Lora" /
  // "Be Vietnam Pro" as string literals with no way to override them. It
  // now reads o.fonts.{display,body,mono} when present, FALLING BACK to the
  // original hardcoded literals when o.fonts is absent — so any caller that
  // doesn't pass fonts (e.g. an older/simpler snapshot) renders exactly as
  // before. Font-family strings + their CSS generic fallback keywords are
  // parameterized — colors and the fade logic are untouched.
  //
  // Fix-pass: the display role's generic fallback was already
  // parameterized (genericDisplay); body and mono now are too
  // (genericBody/genericMono), all falling back to their historical
  // literal ("serif"/"sans-serif") when absent — see below.
  //
  // Task 2 (UX6): the title block's GEOMETRY (sizes, gaps, rule width) used
  // to be hardcoded here as em-of-title constants reverse-derived from
  // legacy A4 output. It now comes from window.titleMetrics
  // (generated from web-src/title-metrics.js, byte-identity tested), which
  // measures the REAL glyph widths of the city name so long Vietnamese ward
  // names auto-fit instead of overrunning the poster width. This file stays
  // the frozen plain-<script> renderer; title_metrics.js must be loaded
  // before this one (see poster.html) or drawPosterText throws loudly
  // rather than silently drawing with stale geometry.
  function drawPosterText(ctx, o) {
    const W = o.width, H = o.height;
    const theme = o.theme || {};
    const ink = (theme.ui && theme.ui.text) || "#111";
    const center = o.center || {};
    const showCredits = o.showCredits !== false;
    const fonts = o.fonts || {};
    const displayFont = fonts.display || "Alegreya";
    const bodyFont = fonts.body || "Lora";
    const monoFont = fonts.mono || "Be Vietnam Pro";
    // genericDisplay: the CSS fallback keyword for the title's font
    // shorthand (serif/sans-serif). MUST match the display face's actual
    // character — a mismatched generic (e.g. "serif" fallback with a sans
    // display face) was found during Task 7's VN dev-browser gate to make
    // Chromium's canvas silently render the generic fallback instead of
    // the correct custom @font-face, even though document.fonts reports
    // the face "loaded". font-pairings.js#resolveFonts supplies this.
    const genericDisplay = fonts.genericDisplay || "serif";
    // genericBody/genericMono: same bug, same fix, for the country line and
    // the coords+credits lines respectively. Confirmed live during the
    // fix-pass VN gate: the be-vietnam-pro pairing's country line (sans
    // body face) was silently rendering as generic serif against a
    // hardcoded "serif" fallback until this was parameterized.
    const genericBody = fonts.genericBody || "serif";
    const genericMono = fonts.genericMono || "sans-serif";

    // Geometry comes from window.titleMetrics (generated from
    // web-src/title-metrics.js). See that file for why the old title-relative
    // em constants were wrong. `measure` binds the REAL font so the long-name
    // fit uses true glyph widths, not a character count.
    const measure = (text, px) => {
      const prev = ctx.font;
      ctx.font = `700 ${px}px "${displayFont}", ${genericDisplay}`;
      const w = ctx.measureText(String(text)).width;
      ctx.font = prev;
      return w;
    };
    const M = window.titleMetrics.titleBlockMetrics({
      W, H, city: o.city, titleSizeScale: o.titleSizeScale,
      titlePos: o.titlePos, measure,
    });
    const dimScale = M.dimScale;
    const cx = M.cx, cityY = M.cityY, ruleY = M.ruleY;
    const countryY = M.countryY, coordsY = M.coordsY;
    const titlePx = Math.round(M.titlePx);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = ink;

    // Title GLOW — a soft land-colored bloom behind the text block so it lifts
    // off a busy map.
    //
    // UX7: the band is ON by default. It was opt-in, so every poster shipped
    // with the title sitting raw on the linework. A plate gives its title a
    // cleared band (TerraInk keeps the bottom ~15% clear); `scrim: false`
    // still opts out for a deliberately bare poster.
    //
    // This replaces the original Round-5 "scrim", which was a hard-edged
    // fillRect band feathered on the left and right only: its top and bottom
    // stayed as straight cut lines across the map, so it read as a UI card laid
    // over the plate. A radial gradient has no edge to see — it is a glow of the
    // land color, not a blur or a crop of the map underneath (blurring would
    // destroy the map exactly where the poster's focal point sits).
    //
    // Sized in EM of the title, like the line spacing above, so the glow tracks
    // the type across aspect ratios and titleSizeScale instead of drifting.
    // Drawn on an ellipse (wider than tall) because the text block is wide and
    // short; the alpha ramp is eased so the core reads solid and the falloff
    // never bands.
    const wantBand = o.scrim !== false;
    if (wantBand) {
      const land = (o.theme && o.theme.map && o.theme.map.land) || "#f3ecdd";
      // The block runs from ~1em above the city baseline to the coords line.
      const blockTop = cityY - titlePx * 1.0;
      const blockBottom = coordsY + M.coordsPx * 0.6;
      const gcx = cx;
      const gcy = (blockTop + blockBottom) / 2;
      const ry = (blockBottom - blockTop) / 2 * 1.35; // breathe past the text
      const rx = ry * 2.6;                            // wide, matching the block
      ctx.save();
      // createRadialGradient is circular; scale the axes to get the ellipse.
      ctx.translate(gcx, gcy);
      ctx.scale(rx / ry, 1);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
      grad.addColorStop(0.00, hexToRgba(land, 0.72));
      grad.addColorStop(0.45, hexToRgba(land, 0.52));
      grad.addColorStop(0.75, hexToRgba(land, 0.20));
      grad.addColorStop(1.00, hexToRgba(land, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, ry, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // city — bold display face, the anchor of the block
    ctx.font = `700 ${titlePx}px "${displayFont}", ${genericDisplay}`;
    ctx.globalAlpha = 1;
    ctx.fillText(o.city || "", cx, cityY);

    // divider rule — spans the TITLE's width (floored), centred on it
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * dimScale));
    ctx.beginPath();
    ctx.moveTo(M.ruleX0, ruleY);
    ctx.lineTo(M.ruleX1, ruleY);
    ctx.stroke();
    ctx.restore();

    // country — light body face, uppercased, optically tracked (never tracked
    // when it carries VN combining marks — that would sever a base letter
    // from its diacritic).
    ctx.font = `400 ${Math.round(M.countryPx)}px "${bodyFont}", ${genericBody}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText(window.titleMetrics.trackCountry(String(o.country || "").toUpperCase()), cx, countryY);

    // coordinates — VN-safe sans, muted
    ctx.font = `400 ${Math.round(M.coordsPx)}px "${monoFont}", ${genericMono}`;
    ctx.globalAlpha = 0.75;
    ctx.fillText(formatCoordinates(center.lat, center.lon), cx, coordsY);

    // corner credits: data source bottom-right, our app credit bottom-left.
    if (showCredits) {
      const pad = 0.03 * W;
      ctx.font = `400 ${Math.round(12 * dimScale)}px "${monoFont}", ${genericMono}`;
      ctx.globalAlpha = 0.6;

      ctx.textAlign = "right";
      ctx.fillText(o.attribution || "© OpenStreetMap contributors", W - pad, H - pad);

      ctx.textAlign = "left";
      ctx.fillText("map-poster", pad, H - pad);
    }

    ctx.restore();
  }

  window.applyFades = applyFades;
  window.drawPosterText = drawPosterText;
})();
