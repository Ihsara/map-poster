// web/__tests__/scrim.test.js
import { describe, it, expect, beforeEach } from "vitest";

// Load the IIFE (defines window.drawPosterText) against a fresh window.
// typography.js now consumes window.titleMetrics (Task 2/UX6) for the
// title block's geometry, so title_metrics.js must load first.
async function loadTypography() {
  global.window = global.window || {};
  await import("../title_metrics.js?scrim=" + Math.random());
  await import("../typography.js?scrim=" + Math.random());
  return global.window;
}

function fakeCtx() {
  const ops = [];
  const rec = (name) => (...a) => ops.push({ name, a });
  return {
    ops,
    canvas: {}, save: rec("save"), restore: rec("restore"),
    beginPath: rec("beginPath"), moveTo: rec("moveTo"), lineTo: rec("lineTo"),
    stroke: rec("stroke"), fillRect: rec("fillRect"), fillText: rec("fillText"),
    arc: rec("arc"), fill: rec("fill"),
    translate: rec("translate"), scale: rec("scale"),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: (...a) => {
      ops.push({ name: "createRadialGradient", a });
      return { addColorStop(off, col) { ops.push({ name: "stop", a: [off, col] }); } };
    },
    // Stub glyph metrics for window.titleMetrics' fit calc — deterministic,
    // proportional to string length like the smoke test's stub.
    measureText: (s) => ({ width: String(s).length * 20 }),
    set fillStyle(v) { ops.push({ name: "fillStyle", a: [v] }); },
    get fillStyle() { return "#000"; },
    set strokeStyle(v) {}, set font(v) {}, set globalAlpha(v) {},
    set textAlign(v) {}, set textBaseline(v) {}, set lineWidth(v) {},
  };
}

const O = {
  width: 1000, height: 1414,
  theme: { map: { land: "#f3ecdd" }, ui: { text: "#222" } },
  center: { lat: 10.8, lon: 106.7 }, city: "Bình Thạnh", country: "Quận Bình Thạnh",
  showCredits: false,
};

// The `scrim` flag now draws a soft land-color GLOW (radial gradient), not the
// original hard-edged fillRect band — that band's straight top/bottom cut lines
// read as a UI card pasted over the plate. UX7 flipped it from opt-in to
// opt-out: the glow now draws by DEFAULT (see the "opt-out default" describe
// block below); `scrim: false` still suppresses it entirely.
describe("drawPosterText title glow (o.scrim)", () => {
  let win;
  beforeEach(async () => { win = await loadTypography(); });

  it("scrim:false: nothing is painted behind the text", () => {
    const ctx = fakeCtx();
    win.drawPosterText(ctx, { ...O, scrim: false });
    const firstText = ctx.ops.findIndex((o) => o.name === "fillText");
    const before = ctx.ops.slice(0, firstText);
    expect(before.filter((o) => o.name === "fillRect")).toHaveLength(0);
    expect(before.filter((o) => o.name === "createRadialGradient")).toHaveLength(0);
  });

  it("ON: a radial glow is painted before the text", () => {
    const ctx = fakeCtx();
    win.drawPosterText(ctx, { ...O, scrim: true });
    const firstText = ctx.ops.findIndex((o) => o.name === "fillText");
    const before = ctx.ops.slice(0, firstText);
    expect(before.filter((o) => o.name === "createRadialGradient").length).toBe(1);
    expect(before.filter((o) => o.name === "fill").length).toBeGreaterThanOrEqual(1);
    // and NOT the old hard band
    expect(before.filter((o) => o.name === "fillRect")).toHaveLength(0);
  });

  it("ON: the glow is the theme's LAND color and fades to fully transparent", () => {
    const ctx = fakeCtx();
    win.drawPosterText(ctx, { ...O, scrim: true });
    const stops = ctx.ops.filter((o) => o.name === "stop");
    expect(stops.length).toBeGreaterThanOrEqual(3);
    // #f3ecdd -> rgb(243,236,221); every stop must be that land color
    for (const s of stops) expect(s.a[1]).toContain("243,236,221");
    // opaque-ish core, fully transparent edge => a glow, not a slab
    const alpha = (c) => parseFloat(/,\s*([\d.]+)\)$/.exec(c)[1]);
    const first = stops[0], last = stops[stops.length - 1];
    expect(first.a[0]).toBe(0);
    expect(alpha(first.a[1])).toBeGreaterThan(0.3);
    expect(last.a[0]).toBe(1);
    expect(alpha(last.a[1])).toBe(0);
  });

  it("ON: the glow scales with the title, not the poster height", () => {
    const radius = (scale) => {
      const ctx = fakeCtx();
      win.drawPosterText(ctx, { ...O, scrim: true, titleSizeScale: scale });
      return ctx.ops.find((o) => o.name === "createRadialGradient").a[5]; // r1
    };
    expect(radius(1.6)).toBeGreaterThan(radius(1));
    expect(radius(0.6)).toBeLessThan(radius(1));
  });

  // Coverage gap closed: the tests above only prove a gradient is painted with
  // the right colors/radius — they never check WHERE. A bug that mis-centred
  // the bloom (wrong corner of the poster) would pass all of them, and the
  // band draws on EVERY poster now (UX7 opt-out default), so its position is
  // load-bearing. This derives the expected centre the SAME way typography.js
  // does — from window.titleMetrics.titleBlockMetrics, the block's real
  // geometry — rather than a hardcoded/reverse-engineered number.
  it("ON: the glow is centred on the title block (cx, midpoint of block top/bottom), not the origin/a corner", () => {
    const ctx = fakeCtx();
    win.drawPosterText(ctx, { ...O, scrim: true });

    // Recompute the same measure() typography.js binds — deterministic stub
    // matching fakeCtx().measureText (length * 20), independent of font.
    const measure = (text) => String(text).length * 20;
    const M = win.titleMetrics.titleBlockMetrics({
      W: O.width, H: O.height, city: O.city,
      titleSizeScale: undefined, titlePos: undefined, measure,
    });
    const titlePx = Math.round(M.titlePx);
    const blockTop = M.cityY - titlePx * 1.0;
    const blockBottom = M.coordsY + M.coordsPx * 0.6;
    const expectedGcx = M.cx;
    const expectedGcy = (blockTop + blockBottom) / 2;

    const translate = ctx.ops.find((o) => o.name === "translate");
    expect(translate).toBeTruthy();
    const [gcx, gcy] = translate.a;
    expect(gcx).toBeCloseTo(expectedGcx, 6);
    expect(gcy).toBeCloseTo(expectedGcy, 6);

    // Sanity: the centre must be a real interior point of the 1000x1414
    // canvas, not the origin (0,0) or a corner a mis-centring bug could park
    // it at.
    expect(gcx).toBeGreaterThan(O.width * 0.25);
    expect(gcx).toBeLessThan(O.width * 0.75);
    expect(gcy).toBeGreaterThan(0);
    expect(gcy).toBeLessThan(O.height);
  });
});

// UX7: the band was opt-in (`if (o.scrim)`), so every poster shipped with its
// title sitting raw on the linework. It is now opt-OUT — the glow draws by
// DEFAULT, and only an explicit `scrim: false` suppresses it.
describe("title band (UX7 — opt-out default)", () => {
  let win;
  beforeEach(async () => { win = await loadTypography(); });

  it("draws the land-colored bloom by DEFAULT — the title needs air", () => {
    const ctx = fakeCtx();
    // NOTE: no `scrim` key at all in O — the default must still bloom.
    win.drawPosterText(ctx, { ...O });
    expect(ctx.ops.some((o) => o.name === "createRadialGradient")).toBe(true);
  });

  it("scrim:false still opts OUT", () => {
    const ctx = fakeCtx();
    win.drawPosterText(ctx, { ...O, scrim: false });
    expect(ctx.ops.some((o) => o.name === "createRadialGradient")).toBe(false);
  });
});
