import { CURRENT_WORLD } from "./cycle";
export type GateDeployment = { packageId: string; originalId: string; registryId: string; worldId: string };
// Filled only after reviewed publication, live bytecode/effects and custody verification.
export const GATE_DEPLOYMENT: GateDeployment | null = null;
export const GATE_WORLD = CURRENT_WORLD;
