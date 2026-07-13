import { describe, it, expect, beforeAll } from "vitest";

// palettes.js is a plain global — it expects `window` to exist (like a
// <script> tag would provide). Mirror palette-harmony.test.js's harness:
// shim `window` before a dynamic import (a static import would be hoisted
// above the shim by the module loader).
let P;
beforeAll(async () => {
  if (typeof globalThis.window === "undefined") globalThis.window = {};
  await import("../palettes.js");
  P = globalThis.window.palettes;
});

const THEME = { map: { land: "#F4F1EA", roads: { major: "#3A3631" } }, ui: { text: "#2E2A26" } };
const hueOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
};

describe("poster palette mode (UX7)", () => {
  const DOMAINS = ["food_and_drink", "retail", "education", "health", "civic"];

  it("keeps EVERY domain inside one narrow hue arc (<= 40deg spread)", () => {
    const hues = DOMAINS.map((d) => hueOf(P.color("poster", THEME, d)));
    const spread = Math.max(...hues) - Math.min(...hues);
    expect(spread).toBeLessThanOrEqual(40);
  });

  it("separates domains by VALUE, not hue — lightness must actually differ", () => {
    const ls = DOMAINS.map((d) => {
      const hex = P.color("poster", THEME, d);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    });
    expect(new Set(ls.map((l) => l.toFixed(2))).size).toBeGreaterThan(3);
  });

  it("never emits a saturated data-viz hue (sat <= 45%)", () => {
    for (const d of DOMAINS) {
      const hex = P.color("poster", THEME, d);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
      const s = max === min ? 0 : (max - min) / (l > 0.5 ? 2 - max - min : max + min);
      expect(s).toBeLessThanOrEqual(0.45);
    }
  });

  // LIVE-GATE REGRESSION. These are the REAL 13 domain ids in the baked data
  // (the Overture taxonomy). palettes.js's hardcoded DOMAINS table predates it
  // and contains only THREE of them, so the other ten fell through to the hash
  // fallback and COLLIDED: 13 categories rendered in 7 colours, with
  // food_and_drink and cultural_and_historic coming out IDENTICAL — in the one
  // mode whose entire promise is that categories separate by value.
  // category_layer.js now hands the live tree order to setDomainOrder().
  const LIVE_DOMAINS = [
    "arts_and_entertainment", "community_and_government", "cultural_and_historic",
    "education", "food_and_drink", "geographic_entities", "health_care",
    "lifestyle_services", "lodging", "services_and_business", "shopping",
    "sports_and_recreation", "travel_and_transportation",
  ];

  it("gives every REAL baked domain its own colour once the live order is registered", () => {
    P.setDomainOrder(LIVE_DOMAINS);
    const hexes = LIVE_DOMAINS.map((d) => P.color("poster", THEME, d));
    expect(new Set(hexes).size).toBe(LIVE_DOMAINS.length);
    P.setDomainOrder([]); // leave the module as we found it
  });

  it("still holds the plate constraints (one hue arc, unsaturated) on the real domains", () => {
    P.setDomainOrder(LIVE_DOMAINS);
    const hues = [], sats = [];
    for (const d of LIVE_DOMAINS) {
      const hex = P.color("poster", THEME, d);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
      sats.push(max === min ? 0 : (max - min) / (l > 0.5 ? 2 - max - min : max + min));
      const dd = max - min;
      let h = 0;
      if (dd) h = max === r ? ((g - b) / dd) % 6 : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
      hues.push(((h * 60) + 360) % 360);
    }
    expect(Math.max(...hues) - Math.min(...hues)).toBeLessThanOrEqual(40);
    expect(Math.max(...sats)).toBeLessThanOrEqual(0.45);
    P.setDomainOrder([]);
  });
});
