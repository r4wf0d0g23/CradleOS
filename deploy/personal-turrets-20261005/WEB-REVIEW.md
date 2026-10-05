# Personal turret controls and attribution release

- Requested by Raw: supported per-owner turret settings, simple UI, Fenris studio-name correction and reduced repeated notices.
- Official rebrand verified against Fenris's May 6, 2026 announcement; sources/NOTICE retain attribution without per-card disclaimers. Historical code namespaces unchanged.
- New isolated package published at source 8d188b2. Existing core package and all real users' turret objects unchanged. Receipt in onchain.json.
- Exact game callback: `turret::get_target_priority_list(&Turret, &Character, vector<u8>, OnlineReceipt): vector<u8>`.
- Settings are OwnerCap-gated metadata appended to the current description; no shared tribe policy or founder role. Invalid settings hold fire. Foreign replacement requires consent; frozen bindings respected.
- UI presents engagement, priority, class preference, with pilot/tribe lists under Advanced. Fresh ownership/version/account preflight and on-chain authorization apply. Game-default restoration has an explicit confirmation.
- Gate-only setup extracted to preserve existing access controls: no dev override or fallback tribe, complete fail-closed discovery, fresh owned Character checks and wallet-scoped messages.

## Gates

- 19 Move tests; source verification against published package passed.
- 112 frontend/server tests; TypeScript production build passed.
- 4 icon-extraction tests; 8 Origins canon checks; dependency IOC scan clean.
- Desktop 1440px/mobile 390px card interactions, failed/cancelled actions, invalid IDs, frozen bindings, restore-default draft handling, overflow and route checks passed.
- Actual current-world GraphQL discovery returned two owned online turrets; actual gate setup query resolved the Character's tribe. No signed mutations made.
- Independent native reviewer cleared architecture, contract, final frontend and extracted gate reads. Requested Opus model unavailable; inherited native reviewer used, not represented as Opus.
- Structured published-package VM simulation: only foreign aggressor returned (item13, weight101), hold-fire returned empty vector, wrong owner rejected by official Character module. See live-vm-proof.json. Checks-disabled simulation proves Move behavior only, not wallet execution/game dispatcher invocation.
- No user turret automatically enrolled. Game-server firing observation remains unverified.

## Publication

Production target is cradleos.io only. Previous rollback deployment: b7360bef. GitHub Pages remains a redirect, not a second application deployment. The web deployment receipt and live verification are recorded separately after publication.
