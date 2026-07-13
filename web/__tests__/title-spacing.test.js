// web/__tests__/title-spacing.test.js
//
// The title block's four lines (city / rule / country / coordinates) must be
// spaced in EM off the title's own font size — not in fractions of poster
// HEIGHT. The type scales off the SHORT edge (dimScale) while the old gaps
// scaled off H, so the two drifted apart: identical code produced ~2.02em gaps
// on a portrait A-series poster but only ~1.43em on a square/landscape one, and
// titleSizeScale moved the type without moving the gaps at all (title collides
// with the rule at 1.6x).
//
// These tests pin the invariant: gap/fontSize is CONSTANT across aspect ratios
// and across titleSizeScale.
import { describe, it, expect, beforeEach } from "vitest";

// typography.js now consumes window.titleMetrics (Task 2/UX6) for the title
// block's geometry, so title_metrics.js must load first.
async function loadTypography() {
  global.window = global.window || {};
  await import("../title_metrics.js?spacing=" + Math.random());
  await import("../typography.js?spacing=" + Math.random());
  return global.window;
}

// Records fillText positions and the font string in play at each one, so we can
// recover the title's pixel size and each line's y offset.
function fakeCtx() {
  const texts = [];
  const lines = [];
  let font = "";
  return {
    texts, lines,
    save() {}, restore() {}, beginPath() {}, stroke() {},
    moveTo(x, y) { lines.push({ x, y }); },
    lineTo(x, y) { lines.push({ x, y }); },
    fillRect() {}, createLinearGradient() { return { addColorStop() {} }; },
    // UX7: the title band draws by DEFAULT now (was opt-in), so this fixture's
    // drawPosterText calls reach the glow's translate/scale/arc/fill — stub
    // them so this file keeps testing line-spacing geometry, not the glow.
    createRadialGradient() { return { addColorStop() {} }; },
    translate() {}, scale() {}, arc() {}, fill() {},
    // Stub glyph metrics for window.titleMetrics' fit calc — deterministic,
    // proportional to string length like the smoke test's stub.
    measureText(s) { return { width: String(s).length * 20 }; },
    set font(v) { font = v; }, get font() { return font; },
    set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
    set textAlign(v) {}, set textBaseline(v) {}, set globalAlpha(v) {},
    fillText(t, x, y) { texts.push({ t, x, y, font }); },
  };
}

const BASE = {
  theme: { map: { land: "#f3ecdd" }, ui: { text: "#222" } },
  center: { lat: 10.8, lon: 106.7 },
  city: "CITY", country: "COUNTRY", showCredits: false,
};

// px size out of a canvas font shorthand like `700 191px "Alegreya", serif`
function fontPx(f) {
  const m = /(\d+(?:\.\d+)?)px/.exec(f);
  return m ? parseFloat(m[1]) : NaN;
}

// Returns the three gaps below the city baseline, expressed in em of the title.
function gapsInEm(win, o) {
  const ctx = fakeCtx();
  win.drawPosterText(ctx, { ...BASE, ...o });
  const city = ctx.texts.find((t) => t.t === "CITY");
  // The country line is now optically tracked (Task 2/UX6): a Latin-only
  // string like "COUNTRY" gets letter-spaced to "C O U N T R Y" by
  // window.titleMetrics.trackCountry. Match on the un-spaced form.
  const country = ctx.texts.find((t) => t.t.replace(/\s+/g, "") === "COUNTRY");
  const coords = ctx.texts.find((t) => /°/.test(t.t));
  const rule = ctx.lines[0];
  const size = fontPx(city.font);
  return {
    size,
    rule: (rule.y - city.y) / size,
    country: (country.y - city.y) / size,
    coords: (coords.y - city.y) / size,
  };
}

describe("title block line spacing is em-based, not height-based", () => {
  let win;
  beforeEach(async () => { win = await loadTypography(); });

  it("gaps are IDENTICAL across aspect ratios (portrait / square / landscape)", () => {
    const portrait = gapsInEm(win, { width: 1000, height: 1414 });
    const square = gapsInEm(win, { width: 1414, height: 1414 });
    const landscape = gapsInEm(win, { width: 1414, height: 1000 });

    // the title size itself legitimately differs (it scales off the short edge)
    // — but the GAPS, measured in em of that title, must not (within the noise
    // introduced by titlePx being rounded to an integer px for ctx.font, since
    // canvas font sizes cannot be fractional — precision 1 absorbs that noise).
    for (const key of ["rule", "country", "coords"]) {
      expect(square[key]).toBeCloseTo(portrait[key], 1);
      expect(landscape[key]).toBeCloseTo(portrait[key], 1);
    }
  });

  it("gaps are IDENTICAL across titleSizeScale (they track the type)", () => {
    const one = gapsInEm(win, { width: 1000, height: 1414, titleSizeScale: 1 });
    const big = gapsInEm(win, { width: 1000, height: 1414, titleSizeScale: 1.6 });
    const small = gapsInEm(win, { width: 1000, height: 1414, titleSizeScale: 0.6 });

    expect(big.size).toBeGreaterThan(one.size);   // the type really did scale
    expect(small.size).toBeLessThan(one.size);
    for (const key of ["rule", "country", "coords"]) {
      expect(big[key]).toBeCloseTo(one[key], 1);
      expect(small[key]).toBeCloseTo(one[key], 1);
    }
  });

  it("matches the window.titleMetrics rhythm (Task 2/UX6 re-basing)", () => {
    // Regression pin, UPDATED for Task 2 (UX6): the title block's geometry now
    // comes from web-src/title-metrics.js, which measures each gap in EM OF
    // THE TYPE ON EITHER SIDE OF IT (RULE_GAP_EM 0.62 of the city, then
    // COUNTRY_LEAD_EM 1.15 of the country, then COORDS_LEAD_EM 1.50 of the
    // coords — see that file's header for why the old title-only em constants
    // (2.02 / 3.30 / 4.58) drifted across aspect ratios and titleSizeScale).
    // These are the resulting city-relative ratios for a short, unfitted city
    // string (BASE_TITLE 54 / BASE_COUNTRY 22 / BASE_COORDS 18 at dimScale 1):
    //   rule    = RULE_GAP_EM = 0.62
    //   country = rule + (BASE_COUNTRY/BASE_TITLE)*COUNTRY_LEAD_EM ≈ 1.089
    //   coords  = country + (BASE_COORDS/BASE_TITLE)*COORDS_LEAD_EM ≈ 1.589
    const g = gapsInEm(win, { width: 1000, height: 1414 });
    expect(g.rule).toBeCloseTo(0.62, 1);
    expect(g.country).toBeCloseTo(1.09, 1);
    expect(g.coords).toBeCloseTo(1.59, 1);
  });

  it("lines stay in order and never collide, even at max title size", () => {
    // UPDATED for Task 2 (UX6): the rule now sits at RULE_GAP_EM (0.62) below
    // the city baseline, not >1em — it hangs just under the title, no longer
    // a full clear em below it (that was the old scheme's spacing, not an
    // invariant). What must still hold at any titleSizeScale: the rule clears
    // the title's descenders (not just > 0 — a rule drawn through the title
    // at e.g. 0.01em would still pass a bare >0 check) and every line stays
    // strictly below the one before it. MINOR-8 re-pin: tightened to > 0.4
    // (the actual computed value here is ~0.62), which genuinely tests the
    // descender-clearance invariant instead of a toothless non-negativity
    // check.
    const g = gapsInEm(win, { width: 1000, height: 1414, titleSizeScale: 1.6 });
    expect(g.rule).toBeGreaterThan(0.4);
    expect(g.country).toBeGreaterThan(g.rule);
    expect(g.coords).toBeGreaterThan(g.country);
  });
});
