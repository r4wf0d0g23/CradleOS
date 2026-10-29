# Empty-fuel node structure-reader correction — 2026-10-29

Raw screenshot1565400109770870885 shows wallet0x29a...bd676 connected/verified but Dashboard unavailable. The full public wallet was uniquely matched from existing local site telemetry; no credentials or player communications used.

Exact read reproduced failure in uint(fuel.unit_volume). Node c4c9f9345e3ef413dff95d8820132b245ddd93bce29559be4beab0e967c67e51 is OFFLINE/quantity0/unit_volume:null/type_id:null. Official world fuel::create initializes this valid state (primitives/fuel.move lines192–210). The prior reader incorrectly rejected it and therefore the complete wallet snapshot.

Narrow fix: explicit null volume with validated zero quantity is zero occupied fuel volume. Missing/malformed values, positive stock without volume, invalid quantity/capacity/burn rate still fail. No cap ownership, object identity, status, pagination, chain, wallet-auth, error or NOT_FOUND gates weakened. No state writes or unrelated feature changes.

Checks:665 frontend tests (seven new regressions); original committed reader still reproduces failure, corrected exactwallet31structures (6nodes/18assemblies/6turrets/1SSU), empty node present/offline/zero fuel; control Tauriskus144structures. Live typed-NOT_FOUND old targets omitted only under existing rules. Source review by native independent reviewer PASS, not Opus. Origins8, approved exactdapp IOC scanner, TypeScript/build pass. Browser/live receipts separate actual supported reads with readonly synthetic wallet from realEVEVaultsigning; no transaction signing performed.

Production baseline/rollback Pagesc0658bfc/source7f15a814. Storage bulk controls, contracts, custody, policies, inventory, House and metrics workers remain unchanged. Do not describe this as a wallet login fix: the reproduced cause was parsing valid empty fuel.
