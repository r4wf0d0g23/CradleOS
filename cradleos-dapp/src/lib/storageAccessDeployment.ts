/** Activate only after fresh-publication, custody and live ABI checks. */
export type StorageAccessDeployment = {
  packageId: string;
  originalId: string;
  registryId: string;
  worldId: string;
};
export const STORAGE_ACCESS_DEPLOYMENT: StorageAccessDeployment | null = null;
