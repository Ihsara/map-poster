// web/__tests__/scrim.test.js
import { describe, it, expect, beforeEach } from "vitest";

// Load the IIFE (defines window.drawPosterText) against a fresh window.
async function loadTypography() {
  global.window = global.window || {};
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
// read as a UI card pasted over the plate. It stays OFF by default.
describe("drawPosterText title glow (o.scrim)", () => {
  let win;
  beforeEach(async () => { win = await loadTypography(); });

  it("OFF by default: nothing is painted behind the text", () => {
    const ctx = fakeCtx();
    win.drawPosterText(ctx, { ...O });
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
});
