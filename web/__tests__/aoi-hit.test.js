// web/__tests__/aoi-hit.test.js
import { describe, it, expect } from "vitest";
import { aoiAtPoint } from "../aoi_hit.js";

const big = { id: "big", name: "Big", bbox: [0, 0, 10, 10] };
const small = { id: "small", name: "Small", bbox: [4, 4, 6, 6] };
const manifest = [big, small];

describe("aoiAtPoint", () => {
  it("returns null when the point is outside every bbox", () => {
    expect(aoiAtPoint([20, 20], manifest)).toBe(null);
  });
  it("returns the only containing entry", () => {
    expect(aoiAtPoint([1, 1], manifest)).toBe(big);
  });
  it("returns the SMALLEST bbox when two overlap", () => {
    expect(aoiAtPoint([5, 5], manifest)).toBe(small);
  });
  it("ignores entries lacking a bbox", () => {
    expect(aoiAtPoint([5, 5], [{ id: "x", name: "X" }, small])).toBe(small);
  });
  it("returns null for an empty manifest", () => {
    expect(aoiAtPoint([5, 5], [])).toBe(null);
  });
});
