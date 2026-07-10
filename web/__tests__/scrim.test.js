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
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
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

describe("drawPosterText scrim", () => {
  let win;
  beforeEach(async () => { win = await loadTypography(); });

  it("scrim OFF: no extra fillRect before the first fillText (baseline)", () => {
    const ctx = fakeCtx();
    win.drawPosterText(ctx, { ...O });
    const firstText = ctx.ops.findIndex((o) => o.name === "fillText");
    const rectsBefore = ctx.ops.slice(0, firstText).filter((o) => o.name === "fillRect").length;
    expect(rectsBefore).toBe(0);
  });
  it("scrim ON: a bounded backing fillRect is drawn before the text", () => {
    const ctx = fakeCtx();
    win.drawPosterText(ctx, { ...O, scrim: true });
    const firstText = ctx.ops.findIndex((o) => o.name === "fillText");
    const rects = ctx.ops.slice(0, firstText).filter((o) => o.name === "fillRect");
    expect(rects.length).toBeGreaterThanOrEqual(1);
    // bounded to the text band, not the whole canvas
    const [x, y, w, h] = rects[0].a;
    expect(w).toBeLessThan(O.width);           // narrower than full width
    expect(x).toBeGreaterThan(0);
  });
});
