import { describe, it, expect, beforeAll } from "vitest";

// palettes.js is a plain global — it expects `window` to exist (like a
// <script> tag would provide). The vitest environment here is "node" (see
// vite.config.js test.environment), so shim `window` before loading, mirroring
// tests/palettes.test.js's `global.window = {}` node-smoke setup. Static
// `import "../palettes.js"` would be hoisted above this shim by the module
// loader, so load it dynamically in beforeAll instead.
let P;
beforeAll(async () => {
  if (typeof globalThis.window === "undefined") globalThis.window = {};
  await import("../palettes.js");
  P = globalThis.window.palettes;
});

const themeEarthy = { map: { roads: { major: "#b5622e" } } }; // clay accent ~ 22°
function hueOf(hex){ /* small hex→hue, mirror palettes.hexToHue */
  const m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  let [r,g,b]=[1,2,3].map(i=>parseInt(m[i],16)/255);
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn; let h=0;
  if(d){ if(mx===r)h=((g-b)/d)%6; else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; }
  return (h*60+360)%360;
}

describe("harmonized palette is theme-anchored", () => {
  it("food_and_drink sits on the theme accent hue", () => {
    const c = P.color("harmonized", themeEarthy, "food_and_drink", null, 1);
    expect(Math.abs(hueOf(c) - 22)).toBeLessThan(8);
  });
  it("no domain lands in the 270–320° purple band on an earthy theme", () => {
    const DOMAINS = ["food_and_drink","retail","health_and_medical","education",
      "arts_and_entertainment","accommodation","active_life","public_service_and_government",
      "automotive","financial_service","beauty_and_spa","professional_services",
      "religious_organization","travel","structure_and_geography"];
    for (const d of DOMAINS) {
      const h = hueOf(P.color("harmonized", themeEarthy, d, null, 1));
      expect(h > 270 && h < 320).toBe(false);
    }
  });
  it("__uncategorized__ is near-grey (very low saturation)", () => {
    const c = P.color("harmonized", themeEarthy, "__uncategorized__", null, 1);
    const m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
    const [r,g,b]=[1,2,3].map(i=>parseInt(m[i],16));
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
    expect((mx-mn)/255).toBeLessThan(0.12); // low chroma
  });
});
