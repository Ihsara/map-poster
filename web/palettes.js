// web/palettes.js — 3 palette systems; parent = one hue, children = value-shades.
// Color job: IDENTITY per domain, DATA-shade per child. Harmonized to the active theme.
(function () {
  function hslToHex(h, s, l) {
    s/=100; l/=100; const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l);
    const f=n=>{const c=l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
      return Math.round(255*c).toString(16).padStart(2,"0");};
    return "#"+f(0)+f(8)+f(4);
  }
  function hexToHue(hex) {
    const m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex||"#cc2244");
    if(!m) return 0;
    let [r,g,b]=[1,2,3].map(i=>parseInt(m[i],16)/255);
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn; let h=0;
    if(d){ if(mx===r)h=((g-b)/d)%6; else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; }
    return (h*60+360)%360;
  }
  // fixed domain order → evenly spread hues (data separation)
  const DOMAINS = ["food_and_drink","retail","health_and_medical","education",
    "arts_and_entertainment","accommodation","active_life","public_service_and_government",
    "automotive","financial_service","beauty_and_spa","professional_services",
    "religious_organization","travel","structure_and_geography","__uncategorized__"];
  const NGU_SAC = [10, 45, 130, 210, 275];        // đỏ vàng lục lam (+ huyền via low-sat)
  const LACQUER = [355, 42, 160, 30];             // oxblood gold jade ivory-ish
  const HARMONY_STEP = 18;   // min gap between adjacent-index hues (degrees)
  const PURPLE_LO = 270, PURPLE_HI = 320; // absolute band to avoid, any theme
  const _cache = new Map(); // key: mode + "|" + accentHex + "|" + domainId -> hue
  const _fanCache = new Map(); // key: accentHex -> offsets[] (index-aligned), memoized per accent

  // Smallest |k| (0..359) such that base + dir*k (dir = +1 or -1) lands inside
  // the absolute purple band [PURPLE_LO, PURPLE_HI]. Returns 360 if it never does.
  function bandDistance(base, dir) {
    for (let k = 0; k <= 359; k++) {
      const h = ((base + dir * k) % 360 + 360) % 360;
      if (h >= PURPLE_LO && h <= PURPLE_HI) return k;
    }
    return 360;
  }

  // Builds a fan of hue offsets around `base`: alternating +/-18°, +36°, -36°...
  // (index 0 stays on-base). If growing one side would cross the absolute
  // purple band, that side closes permanently and every remaining index
  // routes to the other (still-open) side -- so no domain ever lands in the
  // purple band and no two domains collide on the same hue, at the cost of
  // occasionally exceeding the nominal analogous span for a few domains at
  // the tail of a long fan (rare: only bases within ~132 deg of the exact
  // opposite of the purple band's center trigger this).
  function buildFan(base, n) {
    const MARGIN = 2;
    const posLimit = bandDistance(base, 1) - MARGIN;
    const negLimit = bandDistance(base, -1) - MARGIN;
    let posMag = 0, negMag = 0;
    let posOpen = posLimit >= HARMONY_STEP, negOpen = negLimit >= HARMONY_STEP;
    const offsets = [0];
    let preferPos = true;
    for (let i = 1; i < n; i++) {
      let side;
      if (preferPos) side = posOpen ? "pos" : (negOpen ? "neg" : null);
      else side = negOpen ? "neg" : (posOpen ? "pos" : null);
      if (side === "pos") {
        posMag += HARMONY_STEP;
        offsets.push(posMag);
        if (posMag + HARMONY_STEP > posLimit) posOpen = false;
      } else if (side === "neg") {
        negMag += HARMONY_STEP;
        offsets.push(-negMag);
        if (negMag + HARMONY_STEP > negLimit) negOpen = false;
      } else {
        // both sides exhausted -- only possible when base itself sits inside
        // (or immediately beside) the purple band; keep growing the side with
        // more room, unclamped, as a deterministic last resort.
        if (posLimit >= negLimit) { posMag += HARMONY_STEP; offsets.push(posMag); }
        else { negMag += HARMONY_STEP; offsets.push(-negMag); }
      }
      preferPos = !preferPos;
    }
    return offsets;
  }

  function domainHue(mode, theme, domainId) {
    // Known ids use their curated DOMAINS order; unknown ids (real baked domains
    // not in the curated list) get a deterministic char-code hash so they still
    // fan out across distinct hue slots instead of all collapsing to index 0.
    const known = DOMAINS.indexOf(domainId);
    let i;
    if (known >= 0) {
      i = known;
    } else {
      let h = 0;
      const s = String(domainId || "");
      for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) % 97;
      i = DOMAINS.length + h;
    }
    if (mode === "ngu-sac") return NGU_SAC[i % NGU_SAC.length];
    if (mode === "lacquer") return LACQUER[i % LACQUER.length];
    // harmonized: anchor a fan of hues around the theme accent, food_and_drink
    // (index 0) exactly on-accent, never landing in the absolute purple band
    // (see task-11 brief) and never colliding with another domain's hue.
    const accentHex = (theme && theme.map && theme.map.roads && theme.map.roads.major) || "#c22";
    const cacheKey = mode + "|" + accentHex + "|" + domainId;
    if (_cache.has(cacheKey)) return _cache.get(cacheKey);
    const base = hexToHue(accentHex);
    let fan = _fanCache.get(accentHex);
    if (!fan) { fan = buildFan(base, Math.max(i + 1, DOMAINS.length)); _fanCache.set(accentHex, fan); }
    if (i >= fan.length) { fan = buildFan(base, i + 1); _fanCache.set(accentHex, fan); }
    const offset = fan[i];
    const hue = (base + offset + 360) % 360;
    _cache.set(cacheKey, hue);
    return hue;
  }
  function shadeOf(hue, step, total) {
    // children walk lightness 62→38 (darker = "more"); single child → 50
    const l = total <= 1 ? 50 : 62 - (24 * step) / (total - 1);
    const s = 62;
    return hslToHex(hue, s, l);
  }
  function color(mode, theme, domainId, childIndex, childCount) {
    if (domainId === "__uncategorized__") {
      const base = hexToHue((theme && theme.map && theme.map.roads && theme.map.roads.major) || "#c22");
      return hslToHex(base, 6, 62); // near-grey, faintly theme-tinted; applies in ALL modes
    }
    const hue = domainHue(mode, theme, domainId);
    if (childIndex == null) return hslToHex(hue, 60, 48);   // the parent hue
    return shadeOf(hue, childIndex, childCount || 1);
  }
  window.palettes = { modes: ["harmonized","ngu-sac","lacquer"], color, shadeOf,
                      _domainHue: domainHue };
})();
