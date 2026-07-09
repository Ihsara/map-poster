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
    // harmonized: fan out from the theme accent's hue, golden-angle spread
    const base = hexToHue((theme && theme.map && theme.map.roads && theme.map.roads.major) || "#c22");
    return (base + i * 47) % 360;
  }
  function shadeOf(hue, step, total) {
    // children walk lightness 62→38 (darker = "more"); single child → 50
    const l = total <= 1 ? 50 : 62 - (24 * step) / (total - 1);
    const s = 62;
    return hslToHex(hue, s, l);
  }
  function color(mode, theme, domainId, childIndex, childCount) {
    const hue = domainHue(mode, theme, domainId);
    if (childIndex == null) return hslToHex(hue, 60, 48);   // the parent hue
    return shadeOf(hue, childIndex, childCount || 1);
  }
  window.palettes = { modes: ["harmonized","ngu-sac","lacquer"], color, shadeOf,
                      _domainHue: domainHue };
})();
