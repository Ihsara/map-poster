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

async function loadTypography() {
  global.window = global.window || {};
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
    createRadialGradient() { return { addColorStop() {} }; },
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
  const country = ctx.texts.find((t) => t.t === "COUNTRY");
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
    // — but the GAPS, measured in em of that title, must not.
    for (const key of ["rule", "country", "coords"]) {
      expect(square[key]).toBeCloseTo(portrait[key], 5);
      expect(landscape[key]).toBeCloseTo(portrait[key], 5);
    }
  });

  it("gaps are IDENTICAL across titleSizeScale (they track the type)", () => {
    const one = gapsInEm(win, { width: 1000, height: 1414, titleSizeScale: 1 });
    const big = gapsInEm(win, { width: 1000, height: 1414, titleSizeScale: 1.6 });
    const small = gapsInEm(win, { width: 1000, height: 1414, titleSizeScale: 0.6 });

    expect(big.size).toBeGreaterThan(one.size);   // the type really did scale
    expect(small.size).toBeLessThan(one.size);
    for (const key of ["rule", "country", "coords"]) {
      expect(big[key]).toBeCloseTo(one[key], 5);
      expect(small[key]).toBeCloseTo(one[key], 5);
    }
  });

  it("preserves the A-series portrait look the poster was designed against", () => {
    // Regression pin: on the √2 portrait layouts (every A-size), the historical
    // H-fraction gaps worked out to 2.02 / 3.30 / 4.58 em. The em re-basing must
    // reproduce those, so shipped A-series posters do not shift.
    const g = gapsInEm(win, { width: 1000, height: 1414 });
    expect(g.rule).toBeCloseTo(2.02, 1);
    expect(g.country).toBeCloseTo(3.30, 1);
    expect(g.coords).toBeCloseTo(4.58, 1);
  });

  it("lines stay in order and never collide, even at max title size", () => {
    const g = gapsInEm(win, { width: 1000, height: 1414, titleSizeScale: 1.6 });
    expect(g.rule).toBeGreaterThan(1);        // rule clears the title's descenders
    expect(g.country).toBeGreaterThan(g.rule);
    expect(g.coords).toBeGreaterThan(g.country);
  });
});
