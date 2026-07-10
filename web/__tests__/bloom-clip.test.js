// web/__tests__/bloom-clip.test.js — Task 8: pure point-in-polygon filter used
// to clip Bloom + category lighting to the currently-focused polygon.
import { describe, it, expect } from "vitest";
import { pointInRings } from "../boundary_geom.js"; // small shared helper (create if absent)

describe("pointInRings", () => {
  const square = [[[0,0],[0,10],[10,10],[10,0],[0,0]]]; // one ring
  it("true inside, false outside", () => {
    expect(pointInRings([5,5], square)).toBe(true);
    expect(pointInRings([20,20], square)).toBe(false);
  });
});
