/** Cycle 7 is a clean wipe. Empty means not deployed, NEVER use a prior-cycle ID. */
export const CYCLE_DEPLOYMENT = {
  cycle: 7,
  chainId: "4c78adac",
  packages: { core: "", casino: "", ssu: "", voting: "", keeperSeal: "" },
  objects: { characterRegistry: "", bountyBoard: "", trustlessBountyBoard: "", keeperShrine: "", ssuRegistry: "", votingRegistry: "", keeperSealRegistry: "", casinoHouse: "" },
  casinoFunded: false,
  votingProvidersReady: false,
} as const;
export const CORE_READY = !!CYCLE_DEPLOYMENT.packages.core && !!CYCLE_DEPLOYMENT.objects.characterRegistry && !!CYCLE_DEPLOYMENT.objects.bountyBoard && !!CYCLE_DEPLOYMENT.objects.trustlessBountyBoard && !!CYCLE_DEPLOYMENT.objects.keeperShrine;
export const VOTING_READY = CORE_READY && !!CYCLE_DEPLOYMENT.packages.voting && !!CYCLE_DEPLOYMENT.objects.votingRegistry && CYCLE_DEPLOYMENT.votingProvidersReady;
export const SSU_READY = !!CYCLE_DEPLOYMENT.packages.ssu && !!CYCLE_DEPLOYMENT.objects.ssuRegistry;
export const CASINO_READY = !!CYCLE_DEPLOYMENT.packages.casino && !!CYCLE_DEPLOYMENT.objects.casinoHouse && CYCLE_DEPLOYMENT.casinoFunded;
export const CURRENT_CONTRACT_PACKAGES = Object.values(CYCLE_DEPLOYMENT.packages).filter(Boolean);
