# SEO/discoverability release review — 2026-11-05

Raw authorized fixing cradleos.io as appropriate, message 1568034802077016105. No Reapers changes.

## Scope

Real XML sitemap (root + four static guide pages), clean origin robots, www-to-apex redirect preserving paths/queries, current search/social metadata, WebSite/SoftwareApplication and breadcrumb structured data. Accessible no-JavaScript root fallback is replaced by the existing app on mount; ordinary visitors and bots receive identical content. The app remains the homepage. App code changes only by a Guide link outside kiosk mode. Static documentation contains feature/setup/FAQ content, not new explanatory application chrome. No dependencies, tracker, contracts, balances, wallet flows, services or DNS changes.

Existing partner metrics noindex/redirect remain. Robots allows crawling so noindex can be observed. Cloudflare-managed training-crawler preferences remain untouched. Guide pages use local CSS, no JavaScript or webfonts.

## Evidence

- Source review PASS (independent inherited model; Opus unavailable). Reviewer verified factual feature statements, all guide links, XML, schema and public source/issue/official-site URLs.
- Origins canon guard: 8 pass; exact-directory approved npm IOC scanner: clean.
- TypeScript + Vite build pass; pre-existing bundle-size/dynamic-import warnings remain. No claim of app-wide performance optimization.
- Preview browser: four guide pages × four widths (320/390/650/1440) × JS on/off = 32 page/layout checks; guide navigation and app-return in both modes; app boot, footer link and Known Space route; no page errors or network failures. Screenshots inspected.
- Sandboxed Chromium uses the host's existing root-owned setuid helper `/opt/nvidia/dgx-oobe-desktop/chrome-sandbox`, no system configuration change. Managed browser startup was unavailable after update; isolated native browser used for QA.
- Static contract checker validates built XML, canonical page/file/link coverage, no runtime guide scripts, metadata, origin robots, partner noindex, and copied guide bytes.

## Deployment

Follow PRIMARY_DEPLOY.md. Prior production: a4d21375-fb7c-41dd-9490-b993e2a465fd (source656eb34). Final source SHA/deployment and postpublish evidence will be recorded in RELEASE.md. Live checks must prove edge robots composition, XML bytes, all five app/partner assets, static guide bytes, host redirects, partner noindex and browser flows.

## Boundaries

No Search Console ownership/indexing claim; no Google crawl/index/ranking or AI citation guarantee. Current app telemetry unchanged. Existing signed-wallet flows were not exercised by this documentation-only release.
