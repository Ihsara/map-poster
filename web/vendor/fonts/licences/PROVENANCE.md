# Font licence provenance — UX6 six added display faces

Written 2026-07-13 as a fix pass on Task 3 (see
`g:\proj\osm\.superpowers\sdd\task-3-report.md`, "Fix pass: licensing
provenance" section, for the full re-download trail). This file is the
honest record of what licence evidence actually exists for each of the
six faces vendored under `web/vendor/fonts/`. We self-host and
redistribute these on a public GitHub Pages site, so provenance has to
be auditable, not asserted.

## Strength scale used below

- **Strong** — the licence is declared *inside the font binary itself*
  (OFL nameID 13/14) or is a well-known upstream OFL family (Google
  Fonts). No external document needs to be trusted.
- **Documented but external** — the binary itself does NOT declare a
  licence; the OFL claim rests on a separate document (a PDF specimen)
  that we have archived alongside the font. Trust in this face's
  licence is only as good as trust in that PDF and its publisher.

---

## CDA Independence — STRONG

- Source: `https://go.collect.vn/CDA-Independence`, downloaded 2026-07-13
  (same URL/size as the original Task 3 fetch: 4,266,246 bytes).
- Evidence: the font binary's own `name` table carries a proper embedded
  OFL notice (nameID 13/14): *"This Font Software is licensed under the
  SIL Open Font License, Version 1.1"*, pointing to
  `https://scripts.sil.org/OFL`. A Vietnamese-language README bundled in
  the distribution confirms the same.
- No external document required — the binary is self-certifying.

## Manrope — STRONG

- Source: Google Fonts `css2?family=Manrope:wght@700` API (UA-gated),
  fetched 2026-07-13.
- Evidence: standard upstream Google Fonts OFL family. Google's static
  700/Bold instance (usWeightClass=700), spliced from the `latin` /
  `latin-ext` / `vietnamese` subset shards per the Task 3 gotcha note.
  Google Fonts' entire catalogue publishes under OFL 1.1 as a matter of
  public record; no per-file specimen needed.

## IBM Plex Serif — STRONG

- Source: Google Fonts `css2?family=IBM+Plex+Serif:wght@700` API
  (UA-gated), fetched 2026-07-13.
- Evidence: same basis as Manrope — standard upstream Google Fonts OFL
  family (IBM's Plex family has shipped under OFL since release).

---

## Westgate — DOCUMENTED BUT EXTERNAL

- Source: `https://republi.sh/wp-content/uploads/2020/05/Westgate-v2.0-1.zip`,
  re-downloaded 2026-07-13 (1,193,955 bytes — byte-identical to the
  original Task 3 fetch).
- **The font binary itself does NOT declare a licence.** `Westgate-Bold.otf`'s
  `name` table (nameID 0) reads "All rights reserved" and has no nameID
  13/14 (licence / licence-URL) records. This is confirmed again on
  re-download; it is not an artifact of the earlier extraction.
- The OFL claim rests entirely on the specimen PDF, archived at
  `licences/westgate-specimen.pdf` (412,965 bytes, the full document —
  small enough to commit whole).
  - **Page 2** ("Technical specifications" box) states plainly:
    *"LICENSING  Released under SIL Open Font License."* — no per-weight
    exception for this face.
  - **Page 25** ("What can you do with these fonts?") states: *"The
    fonts in the **Barber** family are released under SIL Open Font
    License, which means they are free to be used for commercial and
    personal projects... please remember to credit the Republish project
    as well as the type designers' name(s)."* Note this sentence names
    the wrong family ("Barber", not "Westgate") — it is Republish's own
    boilerplate leftover from another product's specimen template, not
    a Westgate-specific typo we introduced. Page 2's clean, per-product
    "LICENSING" line is the more reliable of the two statements and is
    unambiguous; the boilerplate wording on page 25 doesn't contradict
    it, it's just sloppily templated.
  - Credits per the PDF: FONT VERSION 2.0, "Designed by Giang Nguyen"
    (page 1) plus "Designed by Giang Nguyen, Minh Nguyen" (page 25's
    Technical Specifications box) — the two pages disagree on whether
    Minh Nguyen co-designed it. Copyright line (page 1 and 25): "Copyright
    2020 by Giang Nguyen & Behalf Studio." **Not** "Huong Ngo" — that
    name belongs to Đanh Đá's copyright line, not Westgate's; the
    existing `OFL-westgate.txt` header is correct as written.
- **Verdict: the licence is asserted by the type foundry's own specimen
  PDF, not declared in the binary.** We find this credible (Republish is
  a real, attributable studio with a consistent OFL story across all
  three of its Westgate/Đanh Đá/Patriot products, and OFL is exactly
  the licence a "free VN type" project would plausibly choose), but it
  is external evidence, not self-certifying.

## Đanh Đá — DOCUMENTED BUT EXTERNAL, with an important per-weight caveat

- Source: `https://republi.sh/wp-content/uploads/2020/05/Danhda-v2.0-1.zip`,
  re-downloaded 2026-07-13 (328,355 bytes — byte-identical to the
  original Task 3 fetch).
- **The font binary itself does NOT declare a licence.** `DanhDa-Bold.otf`'s
  `name` table reads "All rights reserved", no nameID 13/14.
- The OFL claim rests on the specimen PDF, archived at
  `licences/danhda-specimen.pdf` (264,891 bytes, full document).
  - **Page 2** states: *"LICENSING  Only Danh Da Bold is released under
    SIL Open Font License."* — this is a per-weight carve-out, and it is
    good news for us: **`DanhDa-Bold.otf` is exactly the weight we
    vendored** (`danhda-700.woff2`, per the Task 3 report — "family ships
    one weight only: Bold"). So the carve-out covers our shipped file.
  - **Page 14** ("What can you do with these fonts?") confirms with the
    matching exception spelled the other way: *"Except for the instance
    of Danh Da Outline, the fonts in the Danh Da family are released
    under SIL Open Font License, which means they are free to be used
    for commercial and personal projects... please remember to credit
    the Republish project as well as the type designers' name(s)."*
    ("Danh Da Outline" is a decorative variant not present as a
    shippable weight in this distribution's `Fonts/` folder at all — the
    zip only contains Bold in OTF/WOFF/WOFF2/EOT — so this exception is
    moot for what we vendored.)
  - Credits per the PDF: FONT VERSION 2.0, "Designed by Giang Nguyen"
    (page 1 and page 14's Technical Specifications box — **only** Giang
    Nguyen, no "Minh Nguyen" credit appears anywhere in this PDF).
    Copyright line: "Copyright 2020 by Giang Nguyen & Huong Ngo."
    **Correction needed:** the existing `OFL-danhda.txt` header currently
    reads "Copyright 2020 by Giang Nguyen, Minh Nguyen & Huong Ngo
    (Đanh Đá)" — the "Minh Nguyen" credit does not appear in this face's
    own specimen PDF (it appears in *Westgate's* page-25 box instead, so
    this looks like a copy/paste bleed between the two OFL files written
    in Task 3). Fixed below.
- **Verdict: the licence is asserted by the specimen PDF, not declared
  in the binary — but for Đanh Đá specifically, the PDF's own explicit
  per-weight carve-out actually names the exact file we vendored
  (Bold) as covered.** This is the strongest of the three external-PDF
  cases.

## Patriot — DROPPED, not shipped

- Final adversarial review (2026-07-13, before ship) removed Patriot
  entirely — the catalog entry, the vendored `patriot-700.woff2`, the
  `OFL-patriot.txt` licence file, and `licences/patriot-specimen.pdf`
  have all been deleted. The 8 shipped pairings are Westgate, CDA
  Independence, Đanh Đá, Manrope, IBM Plex Serif, Alegreya · Lora,
  Be Vietnam Pro, and EB Garamond.
- **Why:** Patriot's own specimen PDF self-contradicted on licensing —
  page 2 said only a style called "Finesse Oblique" was OFL (no such
  style exists anywhere in the Patriot family: the zip's `Fonts/` folder
  contains Light, Normal, Regular, Medium, Bold, UltraBold, Black — no
  "Finesse", no "Oblique"), while page 42 granted the WHOLE family OFL
  with no exception. On top of that unresolved contradiction, the font
  binary's own `name` table (`Patriot-Black.otf`) reads "All rights
  reserved" and carries no nameID 13/14 licence record at all. Two
  external documented cases (Westgate, Đanh Đá below) were judged
  credible enough to ship despite resting on an external PDF rather than
  the binary; Patriot's PDF contradicting itself on the one point that
  matters (is the whole family actually OFL) was the deciding factor to
  not ship it, rather than resolve the ambiguity in our favor.
- If this is ever revisited, the next step would be contacting Republish
  (`republish@onbehalfof.studio`) for written confirmation resolving the
  page-2/page-42 contradiction before re-adding the face.

---

# Track B addendum (2026-07-14) — the missing REAL weights + Barber

Track B's finding: the poster's subtitle looked drab because **`alegreya-400`
was never vendored** — `typography.js` draws the country/subtitle line at
weight 400, so the Alegreya pairing's subtitle had no real 400 cut to draw
with. This addendum records the three cuts vendored to fix that, plus one
face **rejected** on its licence.

## Alegreya 400 — STRONG (new cut; 700 already shipped)

- Source: Google Fonts `css2?family=Alegreya:wght@400` API (UA-gated),
  fetched 2026-07-14. Two subset shards were fetched and spliced into one
  self-hosted file (`alegreya-400.woff2`, 24,868 bytes):
  - `latin` shard: `.../4UacrEBBsBhlBjvfkQjt71kZfyBzPgNG9hU4-6qj.woff2`
  - `vietnamese` shard: `.../4UacrEBBsBhlBjvfkQjt71kZfyBzPgNG9hU49KqjgSE.woff2`
  The css2 API serves per-script subsets as **separate files with disjoint
  cmaps** (the same gotcha recorded for Manrope / IBM Plex Serif above): the
  vietnamese shard alone has no base Latin, which the canvas fallback needs.
  The splice pulls the VN shard's 102 extra codepoints (103 glyphs including
  recursively-resolved composite components) into the latin shard's cmap /
  glyf / hmtx. Verified `usWeightClass == 400` and `name` ID 4 == "Alegreya
  Regular" — a **real static 400**, not a faux-bold/faux-light synthesis.
- Evidence: standard upstream Google Fonts OFL family — same self-certifying
  basis as Manrope and IBM Plex Serif. Licence shipped as `OFL-alegreya.txt`.
- **This is the file the whole track is about.** With it, the Alegreya · Lora
  pairing's subtitle role finally has a real 400 cut.

## CDA Independence Text 400 — STRONG (new optical cut; Display 700 already shipped)

- Source: `https://go.collect.vn/CDA-Independence`, **re-downloaded
  2026-07-14** — 4,266,246 bytes, byte-identical to the size recorded for the
  original Task 3 fetch above. The file vendored is
  `Static/OTF/CDAIndependenceText-Regular.otf` (68,608 bytes), converted to
  woff2 (`cda-independence-text-400.woff2`, 39,620 bytes). The extracted OTF
  is byte-identical to the copy the vietnamese-typography skill rendered in
  its Task 3 pass (`cmp` clean), so the skill's ✅ PASS verdict for the Text
  cut transfers to exactly this binary.
- Evidence: **the binary self-declares.** Checked, not assumed —
  `CDAIndependenceText-Regular.otf`'s `name` table carries
  nameID 13: *"This Font Software is licensed under the SIL Open Font
  License, Version 1.1..."* and nameID 14: `https://scripts.sil.org/OFL`.
  Same family and same self-certifying basis as the already-shipped Display
  700 cut, so the existing `OFL-cda-independence.txt` (which is written at
  the **family** level, not per-cut) covers it. `usWeightClass == 400`.
- The bundled Vietnamese README carries no per-weight carve-out — it is a
  usage guide, not a licence restriction. Nothing excludes the Text cut.
- **Why it matters:** CDA Independence ships Display *and* Text optical cuts
  and is VN-native. Vendoring the Text/400 gives the poster a title+subtitle
  split drawn from one designed system, which is exactly what this face is
  built for.

## Barber (Thợ Cạo) 700 — DOCUMENTED BUT EXTERNAL

- Source: `https://republi.sh/wp-content/uploads/2020/05/Barber-v2.0-1.zip`,
  downloaded 2026-07-14 (1,781,022 bytes). Vendored file is the zip's own
  `Fonts/Barber-Complete.woff2` (26,152 bytes) — the layered family's
  "Complete" cut (Fill + Outline + Right + Shadow pre-composed), which is the
  only one that reads as a usable single-font display face. `usWeightClass ==
  700` — a **real 700**, no faux-bold.
- **The font binary itself does NOT declare a licence.** Checked, not assumed:
  `Barber-Complete.otf`'s `name` table nameID 0 reads *"Copyright © 2020 by
  Giang Nguyen & Behalf Studio. All rights reserved."* and it carries **no
  nameID 13/14** records. Same posture as Westgate / Đanh Đá.
- The OFL claim rests on **Barber's OWN specimen PDF**, archived at
  `licences/barber-specimen.pdf` (550,662 bytes, the copy shipped inside the
  official zip's `Documentation/` folder — not a re-fetch of a web mirror).
  - **Page 1** ("Technical specifications" box): *"LICENSING  Released under
    SIL Open Font License."*
  - **Page 31** ("LICENSE" page): *"The fonts in the **Barber** family are
    released under SIL Open Font License, which means they are free to be
    used for commercial and personal projects... please remember to credit
    the Republish project as well as the type designers' name(s)."*
  - The two statements **agree**, both name **Barber** (the correct family),
    and there is **no per-weight carve-out anywhere in the document** — the
    grant is family-wide, so it covers the Complete cut we vendored.
- ⚠️ **On the known trap:** *Westgate's* specimen page 25 wrongly says "the
  fonts in the **Barber** family are released under SIL Open Font License"
  inside Westgate's own PDF (see the Westgate section above). That sentence is
  **not** the evidence used here. Barber's licence rests on **Barber's own
  specimen**, fetched separately from Barber's own zip — which is where that
  boilerplate sentence actually belongs and reads correctly.
- Credits per Barber's PDF: FONT VERSION 2.0, April 2020, "Designed by Giang
  Nguyen, Minh Nguyen". Copyright line: page 1 says *"Copyright © 2020 by
  Giang Nguyen & Behalf Studio"*; page 31's box says *"Copyright © 2020 by
  Giang Nguyen & Huong Ngo"* — the two pages disagree on the second copyright
  holder (the same kind of sloppy templating seen across Republish's
  specimens). This is a **credit-line** discrepancy, not a licensing one: both
  pages grant OFL to the Barber family without exception, so it does not
  affect whether we may redistribute. `OFL-barber.txt` records both designers.
- **Verdict: ship.** External-PDF evidence like Westgate's, but cleaner — the
  document is Barber's own, names its own family, and is internally consistent
  on the one question that matters.

## Finesse (Mỹ Nghệ) — REJECTED, not shipped

Track B's brief admitted Finesse "on the Westgate precedent." **Fetching
Finesse's own specimen defeats that admission.** Its PDF
(`https://republi.sh/finesse-specimen-v2-0/`, 30 pages, v2.0, July 2020)
**contradicts itself on licensing** — the exact defect that got Patriot
dropped:

- **Page 1** ("Technical specifications" box): *"LICENSING  **Only Finesse
  Oblique** is released under SIL Open Font License."* — a per-weight
  carve-out naming **one** of the family's five cuts (Oblique, Regular,
  Italic, Flair, Future).
- **Page 29** ("LICENSING" / "What can you do with these fonts?"): *"The fonts
  in the **Finesse family** are released under SIL Open Font License, which
  means they are free to be used for commercial and personal projects."* — an
  unrestricted, **family-wide** grant with no exception at all.

These cannot both be true. This is structurally identical to Patriot's
page-2-vs-page-42 contradiction, and the precedent set above is explicit
about how we resolve it: *"Patriot's PDF contradicting itself on the one point
that matters (is the whole family actually OFL) was the deciding factor to not
ship it, rather than resolve the ambiguity in our favor."* We do not get to
cherry-pick page 29 because it is the answer we wanted.

Note the ironic cross-reference: **Patriot's** specimen carved out a
nonexistent style it called *"Finesse Oblique"* — a name that turns out to be
a real cut of *this* family. That is strong evidence Republish's specimen
licensing boxes were copy-pasted between products and cannot be trusted at
face value, which weakens rather than strengthens Finesse's case.

Even if the page-1 carve-out were taken as authoritative, it covers only
**Finesse Oblique** — a slanted script cut, wrong for a poster title role
anyway (and the display role would want the Roman/Regular cut, which the
carve-out explicitly does **not** cover). There is no reading of this document
under which we may confidently redistribute the cut we would actually want.

**Not shipped.** As with Patriot, the next step if ever revisited is written
confirmation from Republish (`republish@onbehalfof.studio`) resolving the
page-1/page-29 contradiction.

---

## Summary table

| Face | Binary declares OFL? | External evidence | Strength |
|---|---|---|---|
| CDA Independence (Display 700 **+ Text 400**) | Yes (nameID 13/14 — re-checked on the Text cut) | — | Strong |
| Alegreya (**400** + 700) | N/A (upstream Google Fonts) | — | Strong |
| Manrope | N/A (upstream Google Fonts) | — | Strong |
| IBM Plex Serif | N/A (upstream Google Fonts) | — | Strong |
| Westgate | No ("All rights reserved") | Specimen PDF p.2, unambiguous | Documented but external |
| Đanh Đá | No ("All rights reserved") | Specimen PDF p.2/p.14, explicit per-weight carve-out covers the shipped Bold | Documented but external (strongest of the three) |
| **Barber** | No ("All rights reserved", no nameID 13/14) | **Barber's own** specimen PDF p.1 + p.31 — agree, name the right family, no carve-out | Documented but external |
| Patriot | No ("All rights reserved") | Specimen PDF p.2 (contradictory/wrong style name) vs. p.42 (unrestricted, family-wide) | **DROPPED — not shipped** (internal contradiction, see above) |
| **Finesse** | Not reached (rejected on the document) | Specimen PDF **p.1 ("Only Finesse Oblique") vs. p.29 (whole family)** — self-contradictory | **REJECTED — not shipped** (same defect as Patriot) |

If Westgate or Đanh Đá's status ever needs to be strengthened further,
the next step would be contacting Republish
(`republish@onbehalfof.studio`, per the "If you are unclear" line in
their specimen PDFs) for written confirmation.

---

# Track fonts addendum (2026-07-14) — 7 faces were vietnamese-shard-only, re-spliced

**Finding:** 7 of the 15 vendored `.woff2` binaries had NO basic Latin —
`alegreya-700`, `lora-400`, `bvp-400`, `bvp-600`, `bvp-700`,
`ebgaramond-400`, `ebgaramond-700`. Measured with fontTools, not assumed:
`alegreya-700.woff2`'s entire cmap was `space A Á Ă ă Đ đ Ĩ ĩ Ũ ũ Ơ ơ Ư ư
[combining marks] Ạạ…Ỹỹ ₫` — no lowercase `a`, no `b`/`n`/`h`, no digits.
Someone had downloaded only the Google Fonts css2 **vietnamese** subset
shard for these 7 files (the same disjoint-cmap gotcha already documented
above for Manrope/Plex Serif/Alegreya-400), never the **latin** shard. Since
`fonts.css` declares no `unicode-range`, the browser silently fell back
per-glyph to the system serif/sans-serif for every basic-Latin character —
rendering "Quận Bình Thạnh" in two different typefaces mid-word, for the
poster's DEFAULT title face, DEFAULT subtitle face, AND the entire panel UI
(`Be Vietnam Pro` via `poster.css`'s `html, body` rule).

**Fix:** re-spliced all 7 using the same recipe documented above — fetched
the css2 API for `latin`, `latin-ext`, and `vietnamese` shards per
(family, weight), merged cmap/glyf/hmtx (recursively resolving composite
glyphs, e.g. combining marks) into one self-hosted file per cut. This is
the identical OFL-upstream Google Fonts basis already recorded for these
four families (Alegreya, Lora, Be Vietnam Pro, EB Garamond) — the licence
story is unchanged, only the binary's completeness changed. Verified
per-file: real `usWeightClass` (400/600/700, no faux-bold), basic Latin
(`a b c n h 0-9`) present, and the VN stress set (`ậ ầ ệ ỡ ữ`) present. See
`web-src/__tests__/font-binary-cmap.test.js` for the automated version of
this check — it reads each vendored binary's actual cmap/OS2 rather than
`fonts.css`'s claim, which is the gap that let these 7 ship in the first
place.

**Cache-busting:** the 7 fixed files replace the broken ones at the SAME
URLs (same filenames), so `fonts.css` now appends `?v=20260714trkc` to each
of their `src:url()`s, and `poster.html` / `index.html` bump their own
`fonts.css?v=` link to `trkc` so a returning visitor re-fetches the CSS
(which in turn busts the woff2 binaries via the per-file query string).

## Attribution credit (OFL requirement)

Westgate's, Đanh Đá's and Barber's OFL grants all explicitly ask: "please
remember to credit the Republish project as well as the type designers'
name(s)." Per the credits recorded above:

- **Westgate** — designed by Giang Nguyen (page 25 also credits Minh
  Nguyen as a co-designer, but page 1's byline names only Giang Nguyen;
  see the Westgate section above for the discrepancy). Copyright 2020 by
  Giang Nguyen & Behalf Studio.
- **Đanh Đá** — designed by Giang Nguyen. Copyright 2020 by Giang Nguyen
  & Huong Ngo.
- **Barber (Thợ Cạo)** — designed by Giang Nguyen, Minh Nguyen (both pages
  of Barber's specimen agree on the designers; the two pages disagree on
  the second copyright holder — see the Barber section above). Copyright
  2020 by Giang Nguyen & Behalf Studio.
- All three faces are published by **Republish** (republi.sh).

This credit is surfaced in the shipped UI (Style panel font-credit line
and export-bar footer) — see `web-src/shell/StyleSection.jsx` and
`web-src/shell/ExportBar.jsx`.
