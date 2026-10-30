import { SuiGrpcClient } from '@mysten/sui/grpc';

export const HEADER_POLL_MS = 30_000;
export const HEADER_STALE_MS = 90_000;
export const TESTNET_CHAIN_ID = '69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD';
export const STILLNESS_HEALTH_URL = 'https://world-api-stillness.live.pub.evefrontier.com/health';
const client = new SuiGrpcClient({ network: 'testnet', baseUrl: 'https://fullnode.testnet.sui.io:443' });

export interface ChainSnapshot {
  checkpoint: number;
  checkpointAt: number;
  epoch: number;
  validators: number | null;
  gasPrice: number | null;
  latencyMs: number;
  observedAt: number;
}
export interface Sample<T> { value: T | null; failed: boolean }
export type HeaderState = 'Checking' | 'Live' | 'Partial' | 'Stale' | 'Unavailable';

function uint(value: unknown): number {
  if (typeof value !== 'bigint' || value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Invalid chain value');
  return Number(value);
}

/** Supported, read-only gRPC calls. Optional epoch reads cannot fabricate zeros. */
export async function readChainSnapshot(
  signal: AbortSignal,
  api: Pick<SuiGrpcClient, 'ledgerService'> = client,
): Promise<ChainSnapshot> {
  const start = performance.now();
  const info = await api.ledgerService.getServiceInfo({}, { abort: signal, timeout: 8000 }).response;
  signal.throwIfAborted();
  const observedAt = Date.now();
  if (info.chain !== 'testnet' || info.chainId !== TESTNET_CHAIN_ID) throw Error('Unexpected network');
  const checkpoint = uint(info.checkpointHeight), epoch = uint(info.epoch);
  const seconds = uint(info.timestamp?.seconds), nanos = info.timestamp?.nanos;
  if (!Number.isInteger(nanos) || nanos! < 0 || nanos! >= 1e9) throw Error('Invalid checkpoint time');
  const checkpointAt = seconds * 1000 + Math.floor(nanos! / 1e6);
  if (!Number.isSafeInteger(checkpointAt) || checkpointAt <= 0 || checkpointAt > observedAt + 30_000) throw Error('Invalid checkpoint time');
  const result: ChainSnapshot = { checkpoint, checkpointAt, epoch, observedAt,
    latencyMs: Math.max(0, Math.round(performance.now() - start)), validators: null, gasPrice: null };
  try {
    const { epoch: data } = await api.ledgerService.getEpoch({ epoch: info.epoch,
      readMask: { paths: ['epoch', 'committee', 'reference_gas_price'] } }, { abort: signal, timeout: 8000 }).response;
    if (uint(data?.epoch) !== epoch) throw Error('Epoch mismatch');
    const committee = data?.committee;
    if (committee && committee.epoch === info.epoch && Array.isArray(committee.members) && committee.members.length > 0) {
      result.validators = committee.members.length;
    }
    try { result.gasPrice = uint(data?.referenceGasPrice); } catch { /* Unknown, not zero. */ }
  } catch { /* Preserve the independently validated checkpoint/epoch; mark partial. */ }
  signal.throwIfAborted();
  return result;
}

export async function readStillnessHealth(signal: AbortSignal): Promise<{ observedAt: number }> {
  const response = await fetch(STILLNESS_HEALTH_URL, { signal, cache: 'no-store' });
  if (!response.ok || (await response.json())?.ok !== true) throw Error('API unavailable');
  signal.throwIfAborted();
  return { observedAt: Date.now() };
}

export function chainState(sample: Sample<ChainSnapshot>, now: number): HeaderState {
  if (!sample.value) return sample.failed ? 'Unavailable' : 'Checking';
  if (sample.failed || now - sample.value.observedAt > HEADER_STALE_MS || now - sample.value.checkpointAt > HEADER_STALE_MS) return 'Stale';
  return sample.value.validators === null || sample.value.gasPrice === null ? 'Partial' : 'Live';
}

export function apiState(sample: Sample<{ observedAt: number }>, now: number): string {
  if (sample.failed) return 'Unavailable';
  if (!sample.value) return 'Checking';
  return now - sample.value.observedAt > HEADER_STALE_MS ? 'Stale' : 'Available';
}

export function isMobileBrowser(browser: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): boolean {
  return /Android|iPhone|iPad|iPod/i.test(browser.userAgent)
    || (/Macintosh/i.test(browser.userAgent) && browser.maxTouchPoints > 1);
}
