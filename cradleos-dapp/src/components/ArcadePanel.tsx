import "./ArcadePanel.css";

const GAMES = [
  {
    id: "frontier-drift",
    title: "Frontier Drift",
    genre: "SPACE EXPLORATION",
    features: "Mine · Build · Explore",
    url: "https://frontier-drift.pages.dev/",
    imageAlt: "Frontier Drift: a Lai mining beside a depot",
  },
  {
    id: "rift-run",
    title: "Rift Run",
    genre: "ARCADE COMBAT",
    features: "Six sectors · Boss fights · Upgrades",
    url: "https://frontier-drift-arcade.pages.dev/",
    imageAlt: "Rift Run: a Lai facing feral drones and the Rift Sovereign",
  },
  {
    id: "voidhook",
    title: "Voidhook",
    genre: "TRACTOR PHYSICS",
    features: "Tether · Swing · Salvage",
    url: "https://frontier-arcade.pages.dev/games/voidhook/",
    imageAlt: "Voidhook gameplay",
  },
  {
    id: "gatebreaker",
    title: "Gatebreaker",
    genre: "REACTOR RICOCHET",
    features: "Three decks · Armor · Reactor",
    url: "https://frontier-arcade.pages.dev/games/gatebreaker/",
    imageAlt: "Gatebreaker gameplay",
  },
  {
    id: "signal-diver",
    title: "Signal Diver",
    genre: "RHYTHM HACKING",
    features: "Three circuits · Timing · Combos",
    url: "https://frontier-arcade.pages.dev/games/signal-diver/",
    imageAlt: "Signal Diver gameplay",
  },
  {
    id: "wreck-runner",
    title: "Wreck Runner",
    genre: "SHAFT DESCENT",
    features: "Fall · Fire · Recover",
    url: "https://frontier-arcade.pages.dev/games/wreck-runner/",
    imageAlt: "Wreck Runner gameplay",
  },
  {
    id: "feral-circuit",
    title: "Feral Circuit",
    genre: "INERTIAL RACING",
    features: "Three laps · Boost · Heat",
    url: "https://frontier-arcade.pages.dev/games/feral-circuit/",
    imageAlt: "Feral Circuit gameplay",
  },
  {
    id: "dockyard-panic",
    title: "Dockyard Panic",
    genre: "REPAIR RUSH",
    features: "Repair · Refuel · Reload",
    url: "https://frontier-arcade.pages.dev/games/dockyard-panic/",
    imageAlt: "Dockyard Panic gameplay",
  },
  {
    id: "salvage-swarm",
    title: "Salvage Swarm",
    genre: "FERAL SURVIVAL",
    features: "Waves · Upgrades · Guardian",
    url: "https://frontier-arcade.pages.dev/games/salvage-swarm/",
    imageAlt: "Salvage Swarm gameplay",
  },
  {
    id: "scrapline-defense",
    title: "Scrapline Defense",
    genre: "SALVAGE LOGISTICS",
    features: "Towers · Power · Conveyor",
    url: "https://frontier-arcade.pages.dev/games/scrapline-defense/",
    imageAlt: "Scrapline Defense gameplay",
  },
] as const;

export function ArcadePanel() {
  return (
    <section className="arcade-panel" aria-labelledby="arcade-heading">
      <header className="arcade-header">
        <h2 id="arcade-heading">Arcade</h2>
        <span>No wallet required</span>
      </header>
      <div className="arcade-games">
        {GAMES.map(game => (
          <article className="arcade-card" key={game.id} aria-labelledby={`arcade-${game.id}`}>
            <img className="arcade-preview" src={`${import.meta.env.BASE_URL}arcade/${game.id}.webp`}
              alt={game.imageAlt} width={800} height={450} loading="lazy" />
            <div className="arcade-card-body">
              <span className="arcade-genre">{game.genre}</span>
              <h3 id={`arcade-${game.id}`}>{game.title}</h3>
              <p className="arcade-features">{game.features}</p>
              <div className="arcade-card-actions">
                <span className="arcade-controls">Desktop · Touch</span>
                <a className="arcade-play" href={game.url} target="_blank" rel="noopener noreferrer"
                  aria-label={`Play ${game.title} (new tab)`}>Play <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
