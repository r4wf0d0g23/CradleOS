import { CURRENT_WORLD } from "./cycle";
export type GateDeployment = { packageId: string; originalId: string; registryId: string; worldId: string };
// Verified isolated testnet publication 2026-10-30; retained publisher-held UpgradeCap.
export const GATE_DEPLOYMENT: GateDeployment | null = {
  "packageId": "0x52a273e9250744b72fdbd242ebeb89bb0ed0606857c9028963abfd6c1645434e",
  "originalId": "0x52a273e9250744b72fdbd242ebeb89bb0ed0606857c9028963abfd6c1645434e",
  "registryId": "0x193257f2f5b1d07e7dec512c7678f94d6a9bb1e8612f7b3a6825e110d2125755",
  "worldId": "0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92"
};
export const GATE_WORLD = CURRENT_WORLD;
