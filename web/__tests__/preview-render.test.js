// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

async function load() {
  global.window = global.window || {};
  // stub the frozen furniture so we can observe the call
  const drawCalls = [];
  global.window.applyFades = () => {};
  global.window.drawPosterText = (ctx, o) => drawCalls.push(o);
  global.window.titleResolve = ({ titlePos }) => titlePos || { x: 0.5, y: 0.8 };
  await import("../export_preview.js?pr=" + Math.random());
  return { win: global.window, drawCalls };
}

function fakeMap() {
  const cv = document.createElement("canvas");
  cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  const container = document.createElement("div");
  return {
    getCanvas: () => cv,
    getContainer: () => container,
    on: () => {},
  };
}

describe("preview WYSIWYG render", () => {
  let win, drawCalls, map;
  beforeEach(async () => { ({ win, drawCalls } = await load()); map = fakeMap();
    // jsdom canvas.getContext exists but is minimal; stub a recording 2D ctx
    win.__ctxOps = [];
    HTMLCanvasElement.prototype.getContext = () => ({
      save(){}, restore(){}, clearRect(){}, fillRect(){}, fillText(){},
      beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, scale(){},
      createLinearGradient(){ return { addColorStop(){} }; },
      set fillStyle(v){}, set strokeStyle(v){}, set font(v){}, set globalAlpha(v){},
      set textAlign(v){}, set textBaseline(v){}, set lineWidth(v){},
    });
  });

  it("renders drawPosterText with live subtitle + scrim when visible", () => {
    win.exportPreview.mount(map, { aspect: 21 / 29.7 });
    win.exportPreview.setSnapshot({
      city: "Phường Gia Định", country: "Quận Bình Thạnh",
      center: [106.7, 10.8], theme: { map: { land: "#eee" }, ui: { text: "#111" } },
      fonts: {}, titleSizeScale: 1, attribution: "© OSM", venuesPx: [],
    });
    win.exportPreview.setVisible(true);
    const last = drawCalls[drawCalls.length - 1];
    expect(last).toBeTruthy();
    expect(last.city).toBe("Phường Gia Định");
    expect(last.country).toBe("Quận Bình Thạnh");
    expect(last.scrim).toBe(true);
  });
});
