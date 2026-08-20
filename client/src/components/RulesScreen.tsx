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
              <p>
                Every round, your guild's leader names a ticker they believe will rise before the round ends. A rival's call
                is secret unless you pay silver to scout them (see Diplomacy) &mdash; your own call is always visible to you.
              </p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">💻</span>
            <div>
              <h3>Kingdoms &amp; sectors</h3>
              <p>
                Well-known tickers belong to a sector: 💻 Technology, 🏦 Finance, 🛢️ Energy, 🛒 Consumer, ⚙️ Industrial, or 📊
                Index. Win with a Technology pick and bank an extra tile; win with Finance or Energy and earn bonus silver on
                top of the normal reward.
              </p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">🌱</span>
            <div>
              <h3>Expand your holdings</h3>
              <p>
                Call rises &mdash; your guild earns a tile. Call falls or flat &mdash; you hold your ground, nothing more. The
                single best-performing call of the round earns <strong>3 tiles</strong> instead of 1.
              </p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">🪙</span>
            <div>
              <h3>Silver &amp; gold</h3>
              <p>
                Every round, whoever holds strictly the most territory earns 3 silver &mdash; a tie means no clear leader, so
                nobody's paid. At the end of each 2-hour season, the season's territorial leader earns 1 gold (worth 100
                silver). A bigger guild's payout grows with its roster, but slower than headcount &mdash; a solo warband keeps
                every coin it earns.
              </p>
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
              <p>
                Ancient keeps, lumber camps, and ore mines dot the realm, unclaimed by anyone. Hold one and your lands grow
                on their own every other round. A rarer 🏪 Market Exchange pays silver directly instead of expanding your
                borders, and three sector structures - 🏭 Foundry, 🏦 Vault, 🛢️ Refinery - double that sector's bonus for
                whoever holds them.
              </p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">🌊</span>
            <div>
              <h3>Rivers and rarer finds</h3>
              <p>
                Rivers cut across the realm and can't be settled - the only way across is a bridge crossing (marked with
                planks), where a banked tile placement pays a silver toll to claim it. 🏴 Bandit Camps raid whoever's
                nearest until captured, 🗿 Ruins pay a one-time hoard of silver then crumble to dirt, and a 🗼 Watchtower
                reveals any rival you're bordering for free, no scouting required.
              </p>
            </div>
          </div>
          <div className="rules-item">
            <span className="rules-item__icon">⏳</span>
            <div>
              <h3>The season ends</h3>
              <p>
                Each season runs a fixed number of rounds. Whoever holds the most land when it ends earns the season's gold
                coin (see Silver &amp; Gold), then the map is wiped clean and a new season begins.
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
