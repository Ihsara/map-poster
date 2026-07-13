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

## Summary table

| Face | Binary declares OFL? | External evidence | Strength |
|---|---|---|---|
| CDA Independence | Yes (nameID 13/14) | — | Strong |
| Manrope | N/A (upstream Google Fonts) | — | Strong |
| IBM Plex Serif | N/A (upstream Google Fonts) | — | Strong |
| Westgate | No ("All rights reserved") | Specimen PDF p.2, unambiguous | Documented but external |
| Đanh Đá | No ("All rights reserved") | Specimen PDF p.2/p.14, explicit per-weight carve-out covers the shipped Bold | Documented but external (strongest of the three) |
| Patriot | No ("All rights reserved") | Specimen PDF p.2 (contradictory/wrong style name) vs. p.42 (unrestricted, family-wide) | **DROPPED — not shipped** (internal contradiction, see above) |

If Westgate or Đanh Đá's status ever needs to be strengthened further,
the next step would be contacting Republish
(`republish@onbehalfof.studio`, per the "If you are unclear" line in
their specimen PDFs) for written confirmation.

## Attribution credit (OFL requirement)

Westgate's and Đanh Đá's OFL grants both explicitly ask: "please
remember to credit the Republish project as well as the type designers'
name(s)." Per the credits recorded above:

- **Westgate** — designed by Giang Nguyen (page 25 also credits Minh
  Nguyen as a co-designer, but page 1's byline names only Giang Nguyen;
  see the Westgate section above for the discrepancy). Copyright 2020 by
  Giang Nguyen & Behalf Studio.
- **Đanh Đá** — designed by Giang Nguyen. Copyright 2020 by Giang Nguyen
  & Huong Ngo.
- Both faces are published by **Republish** (republi.sh).

This credit is surfaced in the shipped UI (Style panel font-credit line
and export-bar footer) — see `web-src/shell/StyleSection.jsx` and
`web-src/shell/ExportBar.jsx`.
