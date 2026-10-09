import { CURRENT_CYCLE, PATCH_NOTES_URL } from "../lib/cycle";

export function CycleStatus() {
  return <div className="cycle-status">
    <strong>{CURRENT_CYCLE}</strong> · <a href={PATCH_NOTES_URL} target="_blank" rel="noreferrer">Patch notes ↗</a>
  </div>;
}

export function ExplorationUnavailable() {
  return <section className="cycle-status-body" aria-label="Exploration status">
    <h2>Exploration unavailable</h2>
    <p>Routes: in-game map</p>
  </section>;
}

export function HistoricalDataNotice() {
  return <p className="cycle-status-body" role="note">Historical fitting data · pre-Vestiges</p>;
}

export function CycleContractSetup({ service }: { service?: string }) {
  return <section className="cycle-status-body" aria-label="Deployment status">
    <h2>{service === "casino" ? "Testnet wagering paused" : "Not available"}</h2>
  </section>;
}
