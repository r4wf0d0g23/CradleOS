// Deployment adapter for the existing agent proxy. Legacy DB tables stay intact.
import { DatabaseSync as Database } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { createActivity } from './activity.mjs';

const config = JSON.parse(readFileSync(new URL('./telemetry-config.json', import.meta.url), 'utf8'));
const db = new Database('/home/rawdata/cradleos-agent-proxy/telemetry.db');
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
const client = new SuiGraphQLClient({url:config.graphql, network:'testnet',
  fetch: (input, init) => fetch(input, {...init, signal:AbortSignal.timeout(15_000)})});
const activity = createActivity({ db, config,
  verify: (bytes, signature, address) => verifyPersonalMessageSignature(bytes,signature,{client,address}) });
export const handleVerifyPing = activity.verifyPing;
export const handleMau = activity.mau;
export const handleOnchainMau = activity.onchain;
export const handleCombinedMau = activity.combined;
export const startPolling = activity.start;
export const stopPolling = activity.stop;
