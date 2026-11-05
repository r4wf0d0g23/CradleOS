# CradleOS discoverability — production 2026-11-05

- Source: `aff8d52bede504becd79fe8fc9737e19a66f6ab4` (feature9c3018a; verificationb14b7ce; corrected aliasaff8d52).
- Final Cloudflare Pages deployment: `b30825bf`, https://b30825bf.cradleos-d75.pages.dev
- Primary app: https://cradleos.io/
- Public guide: https://cradleos.io/guide/
- Pre-change rollback: Pages `a4d21375-fb7c-41dd-9490-b993e2a465fd`, runtime source `656eb34108dffe6c3544e3757a1c24896923cdab`.
- Intermediate release `edcbcca6` was superseded after removing the ignored domain-level redirect rule. No outage or app-state changes.

## Delivered

Valid five-URL XML sitemap, clean origin robots with existing managed crawler rules preserved, updated root search/social metadata, WebSite/SoftwareApplication schema, accessible initial HTML/no-JavaScript fallback, four static guides with per-page metadata/canonicals/breadcrumb schema, and a compact Guide link in the existing app. Guide content: overview, features, getting started, FAQ. No new tracker, library, wallet integration, contract or service mutation. No Reapers Shop changes.

## Verification

Origins guard8 and approved exact-directory IOC scanner pass. TypeScript/Vite production build and static contract checker pass. Preview fourguide×fourwidth×JStoggle32layout checks pass; navigation, appreturn, footerGuide and KnownSpace pass. Production assets verified at22:59:29Z: all5JS/CSS hashes, root metadata/schema/reference assertions, fourguideHTML+CSS+sitemap bytes, correctXML MIME, clean edge robots including retained GPTBot restriction, publicnoindex absent, partnermetrics noindex and301 preserved. See `live-assets.json`.

Browser checks use actual release assets and public network reads through a TLS-validating relay, no wallet connection or signing. Isolated Chromium retained its sandbox using the already-installed host helper. Live browser final result is in `live-browser.json`; screenshots are retained locally.

## Explicitly not claimed

- www still serves200 with correct apex canonicals. A true301 is deferred: Pages does not support domain-level `_redirects`, and existing Cloudflare token cannot access zone Rulesets (403). Prepared owner rule: `optional-www-redirect-rule.json`. No global middleware or permission expansion was introduced.
- Google Search Console ownership, submission, indexing, traffic increases, AI citations and field Core Web Vitals are not verified by this deployment.
- Signed player actions were not retested; their implementation is untouched.

Independent source and correction reviews PASS using available inherited model, not unavailable Opus. Final production review PASS: independent public fetches confirmed XML, clean robots/crawler policy, exact guide bytes and alias canonical; final browser receipt at22:59:43Z records32layout cases plus navigation/app checks, zero errors/network failures. Final upload receipt: `deploy-final.log` (b30825bf); `deploy.log` intentionally retains the superseded first upload.
