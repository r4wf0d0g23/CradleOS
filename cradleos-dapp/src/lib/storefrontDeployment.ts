import { CURRENT_WORLD } from "./cycle";
export type StorefrontDeployment = {
  packageId: string;
  originalId: string;
  registryId: string;
  worldId: string;
};
// Set only after isolated publication, dependency/ABI/registry verification.
export const STOREFRONT_DEPLOYMENT: StorefrontDeployment | null = null;
export const STOREFRONT_WORLD = CURRENT_WORLD;
