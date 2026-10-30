import { useEffect, useState, type ReactNode } from 'react';
import { apiState, chainState, HEADER_POLL_MS, isMobileBrowser, readChainSnapshot, readStillnessHealth, type Sample } from '../lib/headerStatus';
import './HeaderStatus.css';

function useHeaderSample<T>(read: (signal: AbortSignal) => Promise<T>) {
  const [sample, setSample] = useState<Sample<T>>({ value: null, failed: false });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let disposed = false;
    let pending: AbortController | null = null;
    const load = async () => {
      if (pending || disposed) return;
      const controller = new AbortController();
      pending = controller;
      const timeout = setTimeout(() => controller.abort(), 18_000);
      try {
        const value = await read(controller.signal);
        if (!disposed) setSample({ value, failed: false });
      } catch {
        if (!disposed) setSample(previous => ({ ...previous, failed: true }));
      } finally {
        clearTimeout(timeout);
        pending = null;
        if (!disposed) setNow(Date.now());
      }
    };
    void load();
    const poll = setInterval(() => { if (!document.hidden) void load(); }, HEADER_POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const resume = () => { setNow(Date.now()); if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', resume);
    return () => {
      disposed = true;
      pending?.abort();
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [read]);
  return { sample, now };
}

export function StillnessStatus() {
  const { sample, now } = useHeaderSample(readStillnessHealth);
  const status = apiState(sample, now);
  return <span className="header-api-status" data-state={status} aria-label={`Stillness API: ${status}`}>
    <span className="header-status-dot" aria-hidden="true" />Stillness API · {status}
  </span>;
}

export function ChainHealth({ children }: { children?: ReactNode }) {
  const { sample, now } = useHeaderSample(readChainSnapshot);
  const status = chainState(sample, now), data = sample.value;
  const unknown = status === 'Checking' ? 'Checking' : 'Unavailable';
  const fmt = (value: number | null | undefined) => value == null ? unknown : value.toLocaleString();
  const ageSeconds = data ? Math.max(0, Math.floor((now - data.checkpointAt) / 1000)) : null;
  return <div className="header-chain-status" aria-label="Sui testnet status" data-state={status}>
    <span>Sui testnet <span className="header-status-value">· {status}</span></span>
    <span>CP {data ? `#${fmt(data.checkpoint)}` : unknown}</span>
    {ageSeconds !== null && <span>{ageSeconds}s ago</span>}
    <span>Epoch {fmt(data?.epoch)}</span>
    <span>Validators {fmt(data?.validators)}</span>
    <span>Gas {fmt(data?.gasPrice)}{data?.gasPrice != null ? ' MIST' : ''}</span>
    <span>API {data && status !== 'Stale' ? `${data.latencyMs}ms` : unknown}</span>
    {children}
  </div>;
}

/** Guidance only: a detected provider continues to use the existing connection flow. */
export function MissingVault() {
  const mobile = isMobileBrowser(navigator);
  return <div className="header-missing-vault">
    <span>EVE Vault not detected</span>
    {mobile ? <span className="header-wallet-help">Connect from desktop</span>
      : <a href="https://github.com/evefrontier/evevault/releases" target="_blank" rel="noreferrer">Get EVE Vault ↗</a>}
  </div>;
}
