// GENERATED FROM web-src/title-metrics.js — DO NOT EDIT BY HAND.
// Regenerate with: npm run gen:metrics
(function () {
// title-metrics.js — the poster title block's geometry, as PURE functions.
//
// Extracted from web/typography.js, where the four lines were positioned in
// em-multiples of the TITLE (RULE_EM 2.02 / COUNTRY_EM 3.30 / COORDS_EM 4.58)
// while each line's SIZE came independently off dimScale. Gaps tracked one
// scale and type tracked another, so they drifted: the rule sat over a full em
// of empty space below the city baseline, and the country line's leading came
// out ~3x its own type size. Those constants were reverse-derived to preserve
// legacy A4 output — never designed.
//
// Here every gap is measured in EM OF THE TYPE ON EITHER SIDE OF IT, so the
// block keeps one rhythm at any aspect ratio and any titleSizeScale.
//
// `measure` is injected (ctx.measureText in production, a stub in tests) which
// keeps this module pure AND lets the long-name fit use REAL font widths.
// Character count is not usable for Vietnamese: diacritics add no width, so
// "Phường Phú Xuân" is far narrower than its 15 characters imply in a
// condensed face and wider in a geometric one.

const REF = 1400;          // reference short edge for per-dimension scaling
const BASE_TITLE = 54;     // px at REF — unchanged from the original
const BASE_COUNTRY = 22;
const BASE_COORDS = 18;

// Gaps, each in EM of the type that governs it.
const RULE_GAP_EM = 0.62;      // of the CITY: sits just under its baseline
const COUNTRY_LEAD_EM = 1.15;  // of the COUNTRY
const COORDS_LEAD_EM = 1.50;   // of the COORDS

const TITLE_MAX_WIDTH = 0.72;  // fraction of poster width the title may occupy
const TITLE_FIT_FLOOR = 0.42;  // never shrink past this (illegibility)
const MIN_RULE_WIDTH = 0.18;   // fraction of poster width

// Shrink the title until it fits the width budget. Returns a multiplier in
// [floor, 1]. This is the long-VN-name fix: a 15-character ward name is no
// longer rendered at full size with the rest of the block hanging off it.
function cityFitScale({ city, measure, titlePx, maxWidth, floor = TITLE_FIT_FLOOR }) {
  const text = String(city || "");
  if (!text || !titlePx || !maxWidth) return 1;
  const w = measure(text, titlePx);
  if (!(w > maxWidth)) return 1;
  return Math.max(floor, maxWidth / w);
}

// True when the string is safe to letter-space: splitting a string that carries
// combining marks could sever a base letter from its diacritic. NFD-decompose
// and look for any combining mark (U+0300–U+036F).
function hasCombiningMarks(s) {
  return /[̀-ͯ]/.test(String(s).normalize("NFD"));
}

// Optically track out the country line. Latin-only strings get spaced; anything
// carrying Vietnamese marks is returned untouched.
function trackCountry(s) {
  const text = String(s || "");
  if (!text || hasCombiningMarks(text)) return text;
  return text.split("").join(" ");
}

// The whole block's geometry. Returns baselines, sizes and the rule's extent.
function titleBlockMetrics({ W, H, city, titleSizeScale, titlePos, measure }) {
  const scale = (typeof titleSizeScale === "number" && titleSizeScale > 0) ? titleSizeScale : 1;
  const dimScale = Math.max(0.45, Math.min(W, H) / REF);
  const m = typeof measure === "function" ? measure : (t, px) => t.length * px * 0.55;

  // Fit the title to the width budget FIRST, then hang the block off the result.
  const wanted = BASE_TITLE * dimScale * scale;
  const fit = cityFitScale({ city, measure: m, titlePx: wanted, maxWidth: W * TITLE_MAX_WIDTH });
  const titlePx = wanted * fit;

  // The small lines scale with the title too, so the block cannot distort when
  // titleSizeScale moves (the old code left them fixed).
  const countryPx = BASE_COUNTRY * dimScale * scale;
  const coordsPx = BASE_COORDS * dimScale * scale;

  const tp = titlePos && typeof titlePos.x === "number" ? titlePos : null;
  const cx = tp ? tp.x * W : W / 2;
  const cityY = tp ? tp.y * H : H * 0.80;

  const ruleY = cityY + titlePx * RULE_GAP_EM;
  const countryY = ruleY + countryPx * COUNTRY_LEAD_EM;
  const coordsY = countryY + coordsPx * COORDS_LEAD_EM;

  // The rule relates to the NAME, not to the poster: a fixed 40%->60% band left
  // a short name ("Huế") sitting over an unmoored line.
  const titleW = m(String(city || ""), titlePx);
  const ruleW = Math.max(titleW, W * MIN_RULE_WIDTH);
  const ruleX0 = cx - ruleW / 2;
  const ruleX1 = cx + ruleW / 2;

  return { titlePx, countryPx, coordsPx, cx, cityY, ruleY, countryY, coordsY, ruleX0, ruleX1, dimScale };
}

  window.titleMetrics = { cityFitScale, trackCountry, titleBlockMetrics };
})();
