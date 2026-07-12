// Poster furniture: a 25/25 land-color fade top+bottom, plus a low, centered
// text block (city / rule / country / coordinates) drawn onto a 2D context.
// Default fonts (loaded via poster.html <link>): Alegreya (display), Lora
// (country), Be Vietnam Pro (VN-safe coords + attribution) — overridable
// per-call via o.fonts (Task 7, see drawPosterText below).
(function () {
  const REF = 1400; // reference short-edge for per-dimension scaling

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
  // before. This is the only sanctioned edit to this frozen file; only the
  // font-family strings + their CSS generic fallback keywords (and the
  // title-size multiplier below) are parameterized — sizes, positions,
  // colors, and the fade logic are untouched.
  //
  // Fix-pass: the display role's generic fallback was already
  // parameterized (genericDisplay); body and mono now are too
  // (genericBody/genericMono), all falling back to their historical
  // literal ("serif"/"sans-serif") when absent — see below.
  function drawPosterText(ctx, o) {
    const W = o.width, H = o.height;
    const theme = o.theme || {};
    const ink = (theme.ui && theme.ui.text) || "#111";
    const center = o.center || {};
    const showCredits = o.showCredits !== false;
    const dimScale = Math.max(0.45, Math.min(W, H) / REF);
    const tp = o.titlePos && typeof o.titlePos.x === "number" ? o.titlePos : null;
    const cx = tp ? tp.x * W : W / 2;
    const cityY = tp ? tp.y * H : H * 0.80;
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
    const titleScale = (typeof o.titleSizeScale === "number" && o.titleSizeScale > 0)
      ? o.titleSizeScale : 1;

    // The title's own pixel size — the single scale the whole block hangs off.
    const titlePx = Math.round(54 * dimScale * titleScale);

    // Line spacing is measured in EM of the title, not in fractions of poster
    // HEIGHT. The old code positioned these four lines at cityY + H*0.055 /
    // H*0.09 / H*0.125 while the type scaled off the SHORT edge (dimScale) —
    // two different scales, so they drifted: the same gaps that read as
    // 2.02/3.30/4.58 em on a √2 portrait collapsed to 1.43/2.33/3.24 em on a
    // square or landscape poster, and raising titleSizeScale grew the type
    // without moving the lines at all (at 1.6x the title ran into the rule).
    // These em values are exactly the ratios the A-series portrait layouts
    // already produced, so every shipped A-size poster renders unchanged while
    // other aspects and title sizes now track the type.
    const RULE_EM = 2.02, COUNTRY_EM = 3.30, COORDS_EM = 4.58;
    const ruleY = cityY + titlePx * RULE_EM;
    const countryY = cityY + titlePx * COUNTRY_EM;
    const coordsY = cityY + titlePx * COORDS_EM;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = ink;

    // Opt-in title GLOW — a soft land-colored bloom behind the text block so it
    // lifts off a busy map. Default OFF (o.scrim falsy) => byte-identical to a
    // poster drawn without it.
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
    if (o.scrim) {
      const land = (o.theme && o.theme.map && o.theme.map.land) || "#f3ecdd";
      // The block runs from ~1em above the city baseline to the coords line.
      const blockTop = cityY - titlePx * 1.0;
      const blockBottom = cityY + titlePx * (COORDS_EM + 0.6);
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

    // divider rule spanning the middle fifth (40%→60% of width)
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * dimScale));
    ctx.beginPath();
    ctx.moveTo(W * 0.40, ruleY);
    ctx.lineTo(W * 0.60, ruleY);
    ctx.stroke();
    ctx.restore();

    // country — light body face, uppercased, tracked out
    ctx.font = `400 ${Math.round(22 * dimScale)}px "${bodyFont}", ${genericBody}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText(String(o.country || "").toUpperCase(), cx, countryY);

    // coordinates — VN-safe sans, muted
    ctx.font = `400 ${Math.round(18 * dimScale)}px "${monoFont}", ${genericMono}`;
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
