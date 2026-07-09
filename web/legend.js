// Baked road-class legend: a small static key the exporter prints, so a reader
// can decode the poster's weight hierarchy. Subordinate furniture — theme ink,
// low contrast. Rows mirror the map's own colors + relative weights.
(function () {
  // roster: label + how to draw the swatch. "road" rows draw a stroke at the
  // class's relative weight; fills draw a small rect; boundary draws dashed.
  function roster(theme, weightBoost) {
    const r = theme.map.roads, mb = weightBoost || 1;
    return [
      { label: "Hero road",        kind: "road", color: r.major,      wt: 2.6 * mb },
      { label: "Secondary",        kind: "road", color: r.minor_high, wt: 1.6 * mb },
      { label: "Street",           kind: "road", color: r.minor_low,  wt: 0.7 * mb },
      { label: "Path",             kind: "road", color: r.path,       wt: 0.5 * mb },
      { label: "Water",            kind: "fill", color: theme.map.water },
      { label: "Parks",            kind: "fill", color: theme.map.parks },
      { label: "District boundary",kind: "dash", color: theme.ui.text },
    ];
  }

  function legendSize(W, scale) {
    const s = scale || 1;
    const rowH = W * 0.018 * s;
    const swatchW = W * 0.045 * s;
    const pad = W * 0.012 * s;
    const font = W * 0.013 * s;
    // widest label roughly "District boundary" — reserve generous text width
    const textW = W * 0.14 * s;
    return { rowH, swatchW, pad, font, textW,
             w: pad * 2 + swatchW + W * 0.008 * s + textW,
             h: pad * 2 + rowH * 7 };
  }

  function drawLegend(ctx, o) {
    const { x, y, theme, W } = o;
    const scale = o.scale || 1;
    const g = legendSize(W, scale);
    ctx.save();
    ctx.translate(x, y);

    // subtle panel: land-tinted card at low alpha so it reads as a plate label
    ctx.globalAlpha = 0.9;

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const rows = roster(theme, o.weightBoost);
    rows.forEach((row, i) => {
      const cy = g.pad + g.rowH * (i + 0.5);
      const sx = g.pad, sxEnd = g.pad + g.swatchW;
      ctx.strokeStyle = row.color; ctx.fillStyle = row.color;
      if (row.kind === "road") {
        ctx.lineWidth = Math.max(1, row.wt * (W / 3508) * 6);
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sxEnd, cy); ctx.stroke();
      } else if (row.kind === "dash") {
        ctx.lineWidth = Math.max(1, W * 0.0016);
        ctx.setLineDash([W * 0.006, W * 0.004]);
        ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sxEnd, cy); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillRect(sx, cy - g.rowH * 0.28, g.swatchW, g.rowH * 0.56);
      }
      ctx.fillStyle = theme.ui.text;
      ctx.globalAlpha = 0.85;
      ctx.font = `500 ${Math.round(g.font)}px "Be Vietnam Pro", sans-serif`;
      ctx.fillText(row.label, sxEnd + W * 0.008 * scale, cy);
      ctx.globalAlpha = 0.9;
    });
    ctx.restore();
    return { w: g.w, h: g.h };
  }

  window.drawLegend = drawLegend;
  window.legendSize = legendSize;
})();
