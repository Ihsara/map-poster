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

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = ink;

    // Round 5: opt-in anti-collision scrim — a soft land-colored backing behind
    // the text block so it lifts off a busy map. Default OFF (o.scrim falsy) =>
    // byte-identical to before. Bounded to the text band, feathered L/R so it
    // reads as part of the plate, not a UI card. (spec 2026-07-11 §C)
    if (o.scrim) {
      const land = (o.theme && o.theme.map && o.theme.map.land) || "#f3ecdd";
      const sx0 = W * 0.30, sx1 = W * 0.70;
      const sy0 = cityY - H * 0.06, sy1 = cityY + H * 0.14;
      const bandColor = hexToRgba(land, 0.35);
      const edgeColor = hexToRgba(land, 0);
      ctx.save();
      const grad = ctx.createLinearGradient(sx0, 0, sx1, 0);
      grad.addColorStop(0, edgeColor);
      grad.addColorStop(0.5, bandColor);
      grad.addColorStop(1, edgeColor);
      ctx.fillStyle = grad;
      ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
      ctx.restore();
    }

    // city — bold display face, the anchor of the block
    ctx.font = `700 ${Math.round(54 * dimScale * titleScale)}px "${displayFont}", ${genericDisplay}`;
    ctx.globalAlpha = 1;
    ctx.fillText(o.city || "", cx, cityY);

    // divider rule spanning the middle fifth (40%→60% of width)
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * dimScale));
    ctx.beginPath();
    ctx.moveTo(W * 0.40, cityY + H * 0.055);
    ctx.lineTo(W * 0.60, cityY + H * 0.055);
    ctx.stroke();
    ctx.restore();

    // country — light body face, uppercased, tracked out
    ctx.font = `400 ${Math.round(22 * dimScale)}px "${bodyFont}", ${genericBody}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText(String(o.country || "").toUpperCase(), cx, cityY + H * 0.09);

    // coordinates — VN-safe sans, muted
    ctx.font = `400 ${Math.round(18 * dimScale)}px "${monoFont}", ${genericMono}`;
    ctx.globalAlpha = 0.75;
    ctx.fillText(formatCoordinates(center.lat, center.lon), cx, cityY + H * 0.125);

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
