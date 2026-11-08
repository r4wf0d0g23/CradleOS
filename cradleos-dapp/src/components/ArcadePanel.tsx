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
