// web/__tests__/title-resolve.test.js
import { describe, it, expect, beforeEach } from "vitest";

async function load() {
  global.window = global.window || {};
  await import("../title_resolve.js?tr=" + Math.random());
  return global.window;
}

describe("titleResolve", () => {
  let win;
  beforeEach(async () => { win = await load(); win.titlePlacement = undefined; });

  it("a dragged titlePos is returned verbatim", () => {
    const r = win.titleResolve({ titlePos: { x: 0.2, y: 0.3 }, venuesPx: [], W: 1000, H: 1400 });
    expect(r).toEqual({ x: 0.2, y: 0.3 });
  });
  it("AUTO with no placement module → undefined", () => {
    const r = win.titleResolve({ titlePos: null, venuesPx: [[1, 2]], W: 1000, H: 1400 });
    expect(r).toBeUndefined();
  });
  it("AUTO with placement module runs pick with the title footprint", () => {
    let seen = null;
    win.titlePlacement = { pick: (pts, cv, wh, opt) => { seen = { pts, cv, wh, opt }; return { x: 0.5, y: 0.7 }; } };
    const r = win.titleResolve({ titlePos: null, venuesPx: [[10, 20]], W: 1000, H: 1400 });
    expect(r).toEqual({ x: 0.5, y: 0.7 });
    expect(seen.cv).toEqual({ w: 1000, h: 1400 });
    expect(seen.wh).toEqual({ w: 500, h: 168 }); // W*0.5, round(H*0.12)=168
    expect(seen.opt).toEqual({ threshold: 8 });
  });
  it("AUTO with empty venues → undefined", () => {
    win.titlePlacement = { pick: () => { throw new Error("should not run"); } };
    const r = win.titleResolve({ titlePos: null, venuesPx: [], W: 1000, H: 1400 });
    expect(r).toBeUndefined();
  });
});
