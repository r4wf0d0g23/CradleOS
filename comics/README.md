# CradleOS Comics — authoring guide

The Comics tab is **data-driven**. Nothing in `src/` needs to change to publish
a chapter — you edit one JSON manifest and drop files in this directory.

## Manifest

`public/data/comics.json` (schema `cradleos.comics.v1`)

```jsonc
{
  "series": [
    {
      "id": "frontier-tales",        // url-safe, also the folder name here
      "title": "Frontier Tales",
      "tagline": "One-line hook (≤140 chars)",
      "author": "Raw",
      "status": "ongoing",           // ongoing | complete | hiatus
      "synopsis": "Longer blurb shown on the series card.",
      "cover": "comics/frontier-tales/cover.webp",   // or null
      "chapters": [
        {
          "n": 1,
          "title": "Chapter 1",
          "subtitle": "The Wake",     // or null
          "publishedAt": "2026-08-20",// or null
          "layout": "page",           // page | spread | scroll
          "pages": [                  // ART pages, in reading order
            "comics/frontier-tales/ch1/page-01.webp",
            "comics/frontier-tales/ch1/page-02.webp"
          ],
          "script": [                 // TEXT pages (used when art is absent)
            { "heading": "PAGE 1", "body": "Panel 1 — ..." }
          ]
        }
      ]
    }
  ]
}
```

### Chapter states (derived, not stored)

| Condition | Reader shows |
|---|---|
| `pages` non-empty | image reader |
| `pages` empty, `script` non-empty | text reader, badged `SCRIPT` |
| both empty | chapter listed but locked, badged `COMING SOON` |

So the three chapters can ship as placeholders today and light up as you fill
them in — no code change, no redeploy of anything but the static files.

## Files

Put art under `public/comics/<seriesId>/ch<N>/`:

```
public/comics/frontier-tales/cover.webp
public/comics/frontier-tales/ch1/page-01.webp
public/comics/frontier-tales/ch1/page-02.webp
```

- **Format:** `.webp` preferred (`.jpg` / `.png` / `.avif` also accepted).
- **Width:** 1400–2000 px is plenty. Keep each page under ~500 KB — the reader
  lazy-loads and preloads only the next two pages, but mobile still pays.
- **Naming:** zero-padded (`page-01`, not `page-1`) so sorting is correct.
- All manifest paths are **relative, no leading slash** — the reader prefixes
  `import.meta.env.BASE_URL`, so the same manifest works on `cradleos.io/` and
  `r4wf0d0g23.github.io/CradleOS/`.

## Regenerating the manifest from disk

After dropping in files:

```bash
cd frontier/cradleos-dapp
node scripts/refresh-comics.mjs
```

It scans `public/comics/`, rewrites each chapter's `pages` array from what's
actually on disk, and **preserves** all hand-authored metadata (titles,
subtitles, synopsis, script blocks, layout, publishedAt). New series/chapter
folders are added as stubs for you to title.

## Deploying

Comics are static assets, so the normal deploy covers it:

```bash
./deploy-both.sh
```

`deploy-both.sh` mirrors the **full** `dist/` tree and its E4 gate samples
non-`assets/` files for HTTP 200, so missing comic art fails the deploy loudly
instead of 404ing in production.
