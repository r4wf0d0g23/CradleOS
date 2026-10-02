import { CURRENT_WORLD } from "./cycle";
import { CYCLE_DEPLOYMENT } from "./cycleDeployment";
export const cycleCacheKey = (key: string) => `cradleos:${CURRENT_WORLD}:${CYCLE_DEPLOYMENT.packages.core || "pending"}:${key}`;
