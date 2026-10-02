/** Cycle 7 is a clean wipe. Empty means not deployed, NEVER use a prior-cycle ID. */
export const CYCLE_DEPLOYMENT = {
  cycle: 7,
  chainId: "4c78adac",
  packages: { core: "0x2581b5d820e604306efa2604970387055e20830f9e3b424b7fed3f78e68361a6", casino: "0x9628fb3b5c589d627d2127581e0c3eb46c3af1f0c1171ce78d0992aebaedbec3", ssu: "0xd73c02463c1c679c94a5d7a133a944798870a2da302a6f4f52f626aa0010721e", voting: "0xf1166f0e22b5c1407ee16d2ff5ce0a3a1d101827b82747df53ff636883b5abec", keeperSeal: "0x384be9488abe3db60996a7788adeb4c936f483b429bb4f7bd997bd248a568c3b" },
  objects: { characterRegistry: "0x6b8789825c7573f297e2b693fe9c9657ea9efd23117619af492b313e32de998e", bountyBoard: "0x56cfe8f8a06b2d2a2648f5e0f7964ebd13a418457ad0877bf75e8e51673a8636", trustlessBountyBoard: "0x74d1928bf2190e0fc114f55ce3d935c7a41b3ed299fc1841562de08e2426ae21", keeperShrine: "0xaf5e19742c910890450bb5da247dd5d7a58411880e8bad740e8a934be1078ead", ssuRegistry: "0x886f99506414699c4f2a6a156b1237bce6806c2f8efa7209fbcfd73e48a0283b", votingRegistry: "0x252bb2cd2d884ee31a8f1614f550d3ed4334017b9ba28864aa49de8add4e2bfd", keeperSealRegistry: "0x46b72c7cb7b2bbb4af2e8a7f4800028cb66310279151ecc75e14a9696d1622c1", casinoHouse: "0x4a0386fc44328714d0d48bb38d99cda6397c089fd753e3abc4f40b1cb1d98370" },
  casinoFunded: false,
  votingProvidersReady: true,
} as const;
export const CORE_READY = !!CYCLE_DEPLOYMENT.packages.core && !!CYCLE_DEPLOYMENT.objects.characterRegistry && !!CYCLE_DEPLOYMENT.objects.bountyBoard && !!CYCLE_DEPLOYMENT.objects.trustlessBountyBoard && !!CYCLE_DEPLOYMENT.objects.keeperShrine;
export const VOTING_READY = CORE_READY && !!CYCLE_DEPLOYMENT.packages.voting && !!CYCLE_DEPLOYMENT.objects.votingRegistry && CYCLE_DEPLOYMENT.votingProvidersReady;
export const SSU_READY = !!CYCLE_DEPLOYMENT.packages.ssu && !!CYCLE_DEPLOYMENT.objects.ssuRegistry;
export const CASINO_READY = !!CYCLE_DEPLOYMENT.packages.casino && !!CYCLE_DEPLOYMENT.objects.casinoHouse && CYCLE_DEPLOYMENT.casinoFunded;
export const CURRENT_CONTRACT_PACKAGES = Object.values(CYCLE_DEPLOYMENT.packages).filter(Boolean);
