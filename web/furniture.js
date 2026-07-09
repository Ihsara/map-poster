// Pan-anywhere-safe atlas furniture: compass rose + scale bar.
(function () {
  function drawCompass(ctx, { x, y, r, color }) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.28, y); ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.28, y); ctx.closePath(); ctx.fill();
    ctx.font = `700 ${Math.round(r * 0.6)}px "Alegreya", serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("N", x, y - r - r * 0.5);
    ctx.restore();
  }

  // meters-per-pixel in Web Mercator at a given zoom + latitude
  function metersPerPixel(latitude, zoom) {
    return 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
  }

  function niceDistance(m) {
    const pows = [1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000];
    for (const p of pows) if (p >= m) return p;
    return 100000;
  }

  function drawScaleBar(ctx, { x, y, latitude, zoom, canvasWidthPx, color, mppScale }) {
    // mppScale accounts for the map raster being scaled (letterbox "cover") into the
    // poster: 1 poster px covers `mppScale` preview px of ground. Defaults to 1 (preview).
    const mpp = metersPerPixel(latitude, zoom) * (mppScale || 1);
    const targetPx = canvasWidthPx * 0.18;
    const targetM = mpp * targetPx;
    const dist = niceDistance(targetM);
    const barPx = dist / mpp;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1, canvasWidthPx * 0.002);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + barPx, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
    ctx.moveTo(x + barPx, y - 6); ctx.lineTo(x + barPx, y + 6); ctx.stroke();
    const label = dist >= 1000 ? `${+(dist / 1000).toFixed(1)} km` : `${dist} m`;
    ctx.font = `600 ${Math.round(canvasWidthPx * 0.015)}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(label, x, y - 8);
    ctx.restore();
  }

  window.drawCompass = drawCompass;
  window.drawScaleBar = drawScaleBar;
  window.metersPerPixel = metersPerPixel;   // exposed for a sanity check
})();
