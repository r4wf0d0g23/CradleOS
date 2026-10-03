import { CURRENT_CYCLE, PATCH_NOTES_URL, LATEST_PATCH_URL, WORLD_RELEASE_URL } from "../lib/cycle";

export function CycleStatus() {
  return <details className="cycle-status">
    <summary><strong>{CURRENT_CYCLE}</strong> · Fresh world · No previous-cycle assets carried forward</summary>
    <div className="cycle-status-body">
      <p>Cycle 7 began on September 29 with a clean wipe. Previous-world funds, games, vaults, policies and obligations are retired; they are not restored or imported into this cycle. Fresh CradleOS contracts are deployed for this cycle. The casino remains paused pending a new bankroll and operating limits.</p>
      <p><strong>Exploration:</strong> the public universe and jump-history APIs were removed. Use your character’s in-game discoveries; the old complete starmap is no longer a current routing source.</p>
      <p><strong>Skills:</strong> nine skills now grow through deepening Memories: Piloting, Gunnery, Tracking, Extraction, Scanning, Hull Repair, Capacitor Economy, Fuel Economy and Signature Control.</p>
      <p><strong>Industry:</strong> mining now cuts fragments; regoliths replace ores. Recipes now use the current-client input/output quantities with explicit route choices and whole-batch planning. Facility availability, duration and gameplay modifiers are not verified. Fitting tables remain historical. The October 1 patch reduces Network Node component requirements from 10 to 8 each and changes Debris refining.</p>
      <p>Current-world GraphQL discovery and the official item catalog use independent public sources. Search and intel use a separately rebuilt Cycle 7 index; the previous-cycle database is archived. A failed read is shown as an error, not evidence that your assets are gone.</p>
      <p><a href={PATCH_NOTES_URL} target="_blank" rel="noreferrer">Cycle 7 notes</a> · <a href={LATEST_PATCH_URL} target="_blank" rel="noreferrer">October 1 changes</a> · <a href={WORLD_RELEASE_URL} target="_blank" rel="noreferrer">Official GitHub world release</a></p>
    </div>
  </details>;
}

export function ExplorationUnavailable() {
  return <section className="cycle-status-body" aria-label="Cycle 7 exploration status">
    <h2>Explore the Frontier</h2>
    <p>Cycle 7 makes exploration personal. Systems and routes are revealed through your character’s discoveries.</p>
    <p>The public solar-system, constellation and character-jump APIs have been removed. CradleOS no longer loads its previous-cycle universe snapshot or presents those routes as current.</p>
    <p>Use the in-game map for discovered systems and route planning. A supported discovery-data integration has not been published.</p>
    <a href={PATCH_NOTES_URL} target="_blank" rel="noreferrer">Read the official exploration changes</a>
  </section>;
}

export function HistoricalDataNotice() {
  return <p className="cycle-status-body" role="note"><strong>Historical reference:</strong> this fitting calculator uses pre-Vestiges data. Cycle 7 changed skills and ship fitting. Do not rely on these results for current ship performance until revalidated.</p>;
}

export function CycleContractSetup({ service }: { service?: string }) {
  if (service === "casino") return <section className="cycle-status-body" aria-label="Cycle 7 casino status"><h2>Casino deployed · awaiting a fresh bankroll</h2><p>The new-cycle Casino is initialized with an empty bankroll and wagering paused. It will open after new funding and operating limits are configured.</p><p>Previous-world funds and games are retired; no balances or obligations have been carried forward.</p></section>;
  return <section className="cycle-status-body" aria-label="Cycle 7 fresh deployment">
    <h2>Fresh start for Cycle 7</h2>
    <p>This service is awaiting its new-cycle deployment. Previous-world balances, games and contracts are retired—not recoverable or carried forward here.</p>
    <p>Current character discovery, inventory reads, intel and Origins remain available. New services will open against fresh contracts only.</p>
  </section>;
}
