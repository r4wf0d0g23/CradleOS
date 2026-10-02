import { CURRENT_WORLD } from './cycle';
import { CYCLE_DEPLOYMENT } from './cycleDeployment';
const KEY = 'cradleos:world-state';
const CURRENT = `${CURRENT_WORLD}:${CYCLE_DEPLOYMENT.packages.core || 'pending'}`;
/** Drop retired operational IDs/state, retaining public reading progress/preferences. */
export function resetRetiredCycleState(storage: Storage) {
  if (storage.getItem(KEY) === CURRENT) return;
  const remove: string[] = [];
  for (let i=0;i<storage.length;i++) {
    const key=storage.key(i); if (!key) continue;
    if (/^(cradleos:|delegation:|delegation-obj:|casino:|cradleos_tribe_vault_id$)/.test(key)) remove.push(key);
  }
  for (const key of remove) storage.removeItem(key);
  storage.setItem(KEY,CURRENT);
}
try { resetRetiredCycleState(localStorage); resetRetiredCycleState(sessionStorage); } catch { /* storage-disabled webviews still use fresh IDs */ }
