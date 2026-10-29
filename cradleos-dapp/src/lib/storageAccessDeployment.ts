/** Activate only after publication/upgrade, custody and live ABI checks. */
export type StorageAccessDeployment = {
  packageId: string;
  originalId: string;
  registryId: string;
  worldId: string;
};
export const STORAGE_ACCESS_DEPLOYMENT: StorageAccessDeployment | null = {
  "packageId": "0xe5267a986c97c61f4d37a41a897f256f5fb8c943cf0a8540aa429510aa6596d0",
  "originalId": "0xb373fbf3bc4236e92494214fe5a57a8e95b62bb0efd6262023daa3d60d86401f",
  "registryId": "0x581cb868c71bece59273b6a5ca361d3ebbbf0259d755b4ae3855d766dd4250f4",
  "worldId": "0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92"
};
