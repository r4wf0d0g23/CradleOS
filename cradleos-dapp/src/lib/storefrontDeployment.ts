import { CURRENT_WORLD } from "./cycle";
export type StorefrontDeployment = {
  packageId: string;
  originalId: string;
  registryId: string;
  worldId: string;
};
// Published GdGJLuhewxRG2bQ8ADD6nh31jTdToDGxaeYCE7HMifDV; source 72bd1cf8210752b69544bc0024bea82a2e94fa8a.
// Relocated bytecode, independent effects, custody, registry and six unsigned live flows verified.
export const STOREFRONT_DEPLOYMENT: StorefrontDeployment | null = {
  packageId:
    "0x2845dbb680315b6f579275b9553847d6dd118f17a9f91b837cc29ef44924853a",
  originalId:
    "0x2845dbb680315b6f579275b9553847d6dd118f17a9f91b837cc29ef44924853a",
  registryId:
    "0x1f75791145a1c8ec7812120ccb52db4f05334ec7b4021bc4ead30998c2a990b1",
  worldId: "0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92",
};
export const STOREFRONT_WORLD = CURRENT_WORLD;
