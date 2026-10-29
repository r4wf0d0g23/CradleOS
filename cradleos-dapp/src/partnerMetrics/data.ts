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
// Historical entries link to immutable deployed snapshots, not newly assigned dates.
const historical = (
  date: string,
  title: string,
  summary: string,
  commit: string,
): Release => ({
  date,
  title,
  summary,
  source: `${REPOSITORY}/commit/${commit}`,
  evidence: `${REPOSITORY}/blob/${commit}/index.html`,
});
export const RELEASES: Release[] = [
  release(
    "2026-10-29",
    "Shared storage and infrastructure access",
    "Owner-configured tribe and pilot sharing, secure transfers and supported live inventory reads.",
    "902ada7c2d6ac55a3040e7fb0b7f6dc74ca18292",
    "storage-config-20261029/README.md",
  ),
  release(
    "2026-10-22",
    "Sports and item-reward books",
    "Testnet escrow, Polymarket-sourced sports results and deadline-driven item rewards.",
    "81d901feff5896600eb8904e1fbf7e465e1d738b",
    "sports-book-20261021/RELEASE.md",
  ),
  release(
    "2026-10-03",
    "Vestiges rebuild",
    "Fresh Cycle 7 contracts, wallet integration and current-cycle game data.",
    "cd5451f8b92f1348cf0b754dc7919c0ae6be2e3a",
    "native-game-data-20261003/release.json",
  ),
  historical(
    "2026-08-19",
    "Origins narrative platform",
    "Serialized EVE Frontier stories, illustrated chapters and an integrated reader.",
    "ee37e38",
  ),
  historical(
    "2026-07-12",
    "Casino expansion",
    "Historical testnet casino expanded to 25 games with shared bankroll and game interfaces.",
    "61f9eb7219a3bd3dc48d42781cf5bd9da9c3c38f",
  ),
  historical(
    "2026-05-04",
    "Gate and defense policies",
    "On-chain gate access enforcement and character-based friendly/hostile controls.",
    "829f0ac707db68836195834f3b3e1285a47502b6",
  ),
  historical(
    "2026-03-27",
    "Tribe operations foundation",
    "Published tribe economy, infrastructure, intelligence and shared-inventory tools.",
    "80bdc4f7f9cb215e1d7eae5ad29578543b64d31e",
  ),
];
