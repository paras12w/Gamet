export function RulesScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="parchment-screen">
      <div className="parchment-card parchment-card--wide">
        <h2>The Laws of the Realm</h2>
        <div className="rules-list">
          <div className="rules-item">
            <span className="rules-item__icon">📜</span>
            <div>
              <h3>Call your stock</h3>
              <p>Every round, your guild's leader names a ticker they believe will rise before the round ends.</p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">🌱</span>
            <div>
              <h3>Expand your holdings</h3>
              <p>Call rises &mdash; your guild earns a tile. Call falls or flat &mdash; you hold your ground, nothing more.</p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">🎒</span>
            <div>
              <h3>Bank &amp; place your tiles</h3>
              <p>
                Earned tiles go into your guild's bank instead of landing automatically. Anytime, your leader can place a
                banked tile on any open field touching your existing territory. The bank holds at most <strong>5 tiles</strong>
                &mdash; win another while it's full and that tile is destroyed instead of banked.
              </p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">⚔️</span>
            <div>
              <h3>Border skirmishes</h3>
              <p>
                When your territory touches a rival's, the next round is a duel: whoever's call performed better claims the
                contested field, marches one field further, and earns a tile for the bank. Losing the duel means losing that
                field.
              </p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">👑</span>
            <div>
              <h3>Conquest</h3>
              <p>Win two duels in a row against the same rival and their entire guild &mdash; lands and all &mdash; falls under your banner.</p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">🏰</span>
            <div>
              <h3>Neutral keeps</h3>
              <p>Ancient keeps dot the realm, unclaimed by anyone. Hold one and your lands grow on their own every other round.</p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">⏳</span>
            <div>
              <h3>The season ends</h3>
              <p>
                Each season runs a fixed number of rounds. Whoever holds the most land when it ends earns lasting gold, then the
                map is wiped clean and a new season begins.
              </p>
            </div>
          </div>
        </div>
        <button className="parchment-card__cta" onClick={onContinue}>
          I understand — let me choose my path
        </button>
      </div>
    </div>
  );
}
