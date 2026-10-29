export const SITE = "https://cradleos.io";
export const REPORT_URL = `${SITE}/partners/metrics/`;
export const SOURCE_URL = "https://keeper.reapers.shop/telemetry/combined";
export const REPOSITORY = "https://github.com/r4wf0d0g23/CradleOS";
export const SOURCE_BRANCH = `${REPOSITORY}/tree/cycle7-vestiges-20261002`;
export const ARCHIVE_URL = `${SOURCE_BRANCH}/deploy`;
// This is the aggregator's actual scope, not a claim that all app packages are indexed.
export const TRACKED_CONTRACTS = {
  "0x2581b5d820e604306efa2604970387055e20830f9e3b424b7fed3f78e68361a6": "Core",
  "0x58fec9cb6c4026d6951d6df86442c281dfd69b6c7a2225d7016c08674e1b3e35":
    "Turrets",
  "0x9628fb3b5c589d627d2127581e0c3eb46c3af1f0c1171ce78d0992aebaedbec3":
    "Casino",
  "0xd73c02463c1c679c94a5d7a133a944798870a2da302a6f4f52f626aa0010721e":
    "Legacy storage",
  "0xf1166f0e22b5c1407ee16d2ff5ce0a3a1d101827b82747df53ff636883b5abec":
    "Voting",
} as const;
export type Release = {
  date: string;
  title: string;
  summary: string;
  source: string;
  evidence: string;
};
const release = (
  date: string,
  title: string,
  summary: string,
  commit: string,
  receipt: string,
): Release => ({
  date,
  title,
  summary,
  source: `${REPOSITORY}/commit/${commit}`,
  evidence: `${REPOSITORY}/blob/cycle7-vestiges-20261002/deploy/${receipt}`,
});
export const RELEASES: Release[] = [
  release(
    "2026-10-29",
    "Storage sharing controls",
    "Tribe and pilot access, expiry, deposit and withdrawal permissions.",
    "902ada7c2d6ac55a3040e7fb0b7f6dc74ca18292",
    "storage-config-20261029/README.md",
  ),
  release(
    "2026-10-29",
    "Live inventory reads",
    "Supported Sui storage reads, partition views and refresh recovery.",
    "da6a7e0bcf697308ed48f78d94801b3e5e732f9c",
    "inventory-read-20261029/release.json",
  ),
  release(
    "2026-10-29",
    "Structure discovery",
    "Current-world structure discovery and wallet-scoped verification.",
    "b565777edea0cb2fb4a7ef52a188a5377fd93a3d",
    "structure-login-20261029/release.json",
  ),
  release(
    "2026-10-22",
    "Testnet sports book",
    "Fixed-fixture Sui escrow with Polymarket-sourced settlement reporting.",
    "81d901feff5896600eb8904e1fbf7e465e1d738b",
    "sports-book-20261021/RELEASE.md",
  ),
  release(
    "2026-10-22",
    "Item reward book",
    "Testnet item rewards with deadline-driven keeper automation.",
    "afb0299efed3cf7eb39e2af5d9866ead27cc7cc5",
    "betting-book-20261021/RELEASE.md",
  ),
  release(
    "2026-10-14",
    "Keeper games",
    "Three lore-based Play Money games with saved round state.",
    "c3bed89691c5103f57ac19df05f2b63ec4cd779c",
    "keeper-games-20261013/RELEASE.md",
  ),
  release(
    "2026-10-05",
    "Current-cycle icon library",
    "Native item and interface icons with a public asset API.",
    "fc526b54a120ff5978ac82e31f9713e9ccc3c177",
    "current-icons-20261005/release.json",
  ),
  release(
    "2026-10-03",
    "Native game data",
    "Current-cycle game data integrated into the application.",
    "cd5451f8b92f1348cf0b754dc7919c0ae6be2e3a",
    "native-game-data-20261003/release.json",
  ),
];
