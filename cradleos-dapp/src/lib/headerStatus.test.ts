import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiState, chainState, HEADER_STALE_MS, isMobileBrowser, readChainSnapshot, readStillnessHealth, TESTNET_CHAIN_ID } from './headerStatus';

const at = 1_793_377_000_000;
const info = () => ({ chain: 'testnet', chainId: TESTNET_CHAIN_ID, epoch: 1268n, checkpointHeight: 400_000_000n,
  timestamp: { seconds: BigInt(at / 1000), nanos: 123_000_000 } });
const epoch = () => ({ epoch: 1268n, referenceGasPrice: 1000n, committee: { epoch: 1268n, members: [{}, {}] } });
function api(service: any = info(), data: any = epoch()) {
  return { ledgerService: {
    getServiceInfo: vi.fn(() => ({ response: service instanceof Error ? Promise.reject(service) : Promise.resolve(service) })),
    getEpoch: vi.fn(() => ({ response: data instanceof Error ? Promise.reject(data) : Promise.resolve({ epoch: data }) })),
  } } as unknown as NonNullable<Parameters<typeof readChainSnapshot>[1]>;
}
const signal = () => new AbortController().signal;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function clock() { vi.spyOn(Date, 'now').mockReturnValue(at + 1000); }

describe('supported header reads', () => {
  it('binds testnet identity and epoch, returns real values, and bounds both calls', async () => {
    clock(); const client = api(), abort = signal();
    const value = await readChainSnapshot(abort, client);
    expect(value).toMatchObject({ checkpoint: 400_000_000, checkpointAt: at + 123, epoch: 1268, validators: 2, gasPrice: 1000, observedAt: at + 1000 });
    expect(Number.isFinite(value.latencyMs)).toBe(true);
    expect(client.ledgerService.getServiceInfo).toHaveBeenCalledWith({}, { abort, timeout: 8000 });
    expect(client.ledgerService.getEpoch).toHaveBeenCalledWith(expect.objectContaining({ epoch: 1268n }), { abort, timeout: 8000 });
  });
  it.each([
    { error: { code: -32601, message: 'removed' } },
    { ...info(), chain: 'mainnet' },
    { ...info(), chainId: 'wrong-genesis' },
    { ...info(), checkpointHeight: undefined },
    { ...info(), checkpointHeight: 9007199254740992n },
    { ...info(), checkpointHeight: -1n },
    { ...info(), epoch: NaN },
    { ...info(), timestamp: undefined },
    { ...info(), timestamp: { seconds: 0n, nanos: 0 } },
    { ...info(), timestamp: { seconds: BigInt(at / 1000 + 60), nanos: 0 } },
    { ...info(), timestamp: { seconds: BigInt(at / 1000), nanos: 1e9 } },
  ])('rejects malformed or misidentified service data %#', async service => {
    clock(); const client = api(service);
    await expect(readChainSnapshot(signal(), client)).rejects.toThrow();
    expect(client.ledgerService.getEpoch).not.toHaveBeenCalled();
  });
  it('rejects an unreachable service, without reporting successful latency', async () => {
    await expect(readChainSnapshot(signal(), api(Error('network')))).rejects.toThrow('network');
  });
  it.each([Error('epoch unavailable'), { ...epoch(), epoch: 1269n }])('retains only validated checkpoint fields when epoch lookup fails %#', async data => {
    clock(); const value = await readChainSnapshot(signal(), api(info(), data));
    expect(value).toMatchObject({ validators: null, gasPrice: null, epoch: 1268 });
    expect(chainState({ value, failed: false }, at + 1000)).toBe('Partial');
  });
  it('keeps valid gas separate from an absent/mismatched committee', async () => {
    clock(); const value = await readChainSnapshot(signal(), api(info(), { ...epoch(), committee: { epoch: 1269n, members: [{}] } }));
    expect(value).toMatchObject({ validators: null, gasPrice: 1000 });
  });
  it('never converts missing gas or an empty committee to zero', async () => {
    clock(); const value = await readChainSnapshot(signal(), api(info(), { epoch: 1268n, committee: { epoch: 1268n, members: [] } }));
    expect(value).toMatchObject({ validators: null, gasPrice: null });
  });
  it('preserves genuine zero values', async () => {
    clock(); const value = await readChainSnapshot(signal(), api({ ...info(), epoch: 0n, checkpointHeight: 0n }, { epoch: 0n, referenceGasPrice: 0n, committee: { epoch: 0n, members: [{}] } }));
    expect(value).toMatchObject({ checkpoint: 0, epoch: 0, gasPrice: 0, validators: 1 });
  });
  it('does not publish partial results after cancellation', async () => {
    clock(); const controller = new AbortController(), client = api();
    vi.mocked(client.ledgerService.getEpoch).mockImplementation(() => {
      controller.abort(); return { response: Promise.reject(Error('aborted')) } as any;
    });
    await expect(readChainSnapshot(controller.signal, client)).rejects.toThrow();
  });
});

describe('honest freshness', () => {
  it('distinguishes loading, total failure, failed refresh, aged sample, aged checkpoint, and recovery', async () => {
    clock(); const value = await readChainSnapshot(signal(), api());
    expect(chainState({ value: null, failed: false }, at)).toBe('Checking');
    expect(chainState({ value: null, failed: true }, at)).toBe('Unavailable');
    expect(chainState({ value, failed: false }, at + 1000)).toBe('Live');
    expect(chainState({ value, failed: true }, at + 1000)).toBe('Stale');
    expect(chainState({ value, failed: false }, at + HEADER_STALE_MS + 2000)).toBe('Stale');
    expect(chainState({ value: { ...value, checkpointAt: at - HEADER_STALE_MS }, failed: false }, at + 1000)).toBe('Stale');
    expect(chainState({ value, failed: false }, at + 1000)).toBe('Live');
  });
  it('labels API reachability independently from chain or game availability', () => {
    expect(apiState({ value: null, failed: false }, at)).toBe('Checking');
    expect(apiState({ value: { observedAt: at }, failed: false }, at)).toBe('Available');
    expect(apiState({ value: { observedAt: at }, failed: false }, at + HEADER_STALE_MS + 1)).toBe('Stale');
    expect(apiState({ value: { observedAt: at }, failed: true }, at)).toBe('Unavailable');
  });
});

describe('API response validation', () => {
  it.each([new Response('{"ok":false}'), new Response('{"other":true}'), new Response('bad JSON'), new Response('{"ok":true}', { status: 503 })])('does not treat an HTTP response alone as healthy %#', async response => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(readStillnessHealth(signal())).rejects.toThrow();
  });
  it('accepts a successful health result and propagates cancellation', async () => {
    clock(); vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('{"ok":true}'))));
    expect(await readStillnessHealth(signal())).toEqual({ observedAt: at + 1000 });
    const abort = new AbortController(); abort.abort();
    await expect(readStillnessHealth(abort.signal)).rejects.toThrow();
  });
});

it.each([
  ['Mozilla/5.0 (Linux; Android 16)', 5, true],
  ['Mozilla/5.0 (iPhone)', 5, true],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X)', 5, true],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X)', 0, false],
  ['Mozilla/5.0 (Windows NT 10.0)', 10, false],
])('uses platform, not narrow viewport, for download guidance: %s', (userAgent, maxTouchPoints, expected) => {
  expect(isMobileBrowser({ userAgent, maxTouchPoints })).toBe(expected);
});
