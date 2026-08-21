import { useEffect } from "react";

interface RuleItem {
  icon: string;
  title: string;
  body: React.ReactNode;
}

interface RuleCategory {
  name: string;
  items: RuleItem[];
}

const CATEGORIES: RuleCategory[] = [
  {
    name: "The Basics",
    items: [
      {
        icon: "📜",
        title: "Call your stock",
        body: (
          <>
            Every round, your guild's leader names a ticker they believe will rise before the round ends. A rival's call is
            secret unless you pay silver to scout them (see Diplomacy) &mdash; your own call is always visible to you.
          </>
        ),
      },
      {
        icon: "🌱",
        title: "Expand your holdings",
        body: (
          <>
            Call rises &mdash; your guild earns a tile. Call falls or flat &mdash; you hold your ground, nothing more. The
            single best-performing call of the round earns <strong>3 tiles</strong> instead of 1.
          </>
        ),
      },
      {
        icon: "🎒",
        title: "Bank & place your tiles",
        body: (
          <>
            Earned tiles go into your guild's bank instead of landing automatically. Anytime, your leader can place a banked
            tile on any open field touching your existing territory. The bank holds at most <strong>5 tiles</strong> &mdash;
            win another while it's full and that tile is destroyed instead of banked.
          </>
        ),
      },
      {
        icon: "🪙",
        title: "How you earn coins",
        body: (
          <>
            Silver trickles in from a few places: holding strictly the most territory pays out every round, certain
            neutral keeps and kingdom sectors pay a bonus on top of a winning call, and whoever holds the most land when
            the season ends earns a gold coin (worth 100 silver). Spend it on scouting, bridges, or the Market &mdash; see
            "Silver, Gold & the Season" below for the full breakdown.
          </>
        ),
      },
    ],
  },
  {
    name: "Territory & Combat",
    items: [
      {
        icon: "⚔️",
        title: "Border skirmishes",
        body: (
          <>
            When your territory touches a rival's, the next round is a duel: whoever's call performed better claims the
            contested field, marches one field further, and earns a tile for the bank. Losing the duel means losing that
            field.
          </>
        ),
      },
      {
        icon: "👑",
        title: "Conquest",
        body: <>Win two duels in a row against the same rival and their entire guild &mdash; lands and all &mdash; falls under your banner.</>,
      },
    ],
  },
  {
    name: "The Map",
    items: [
      {
        icon: "🏰",
        title: "Neutral keeps",
        body: (
          <>
            Ancient keeps, lumber camps, and ore mines dot the realm, unclaimed by anyone. Hold one and your lands grow on
            their own every other round. A rarer 🏪 Market Exchange pays silver directly instead of expanding your borders,
            and three sector structures &mdash; 🏭 Foundry, 🏦 Vault, 🛢️ Refinery &mdash; double that sector's bonus for whoever
            holds them.
          </>
        ),
      },
      {
        icon: "🌊",
        title: "Rivers & bridges",
        body: (
          <>
            Rivers cut across the realm and can't be settled with a banked tile &mdash; instead, buy any river tile
            bordering your territory outright as a bridge for a flat silver cost, right from the board. A river running
            several tiles wide needs a separate bridge purchase for each lane.
          </>
        ),
      },
      {
        icon: "🏴",
        title: "Rarer finds",
        body: (
          <>
            🏴 Bandit Camps raid whoever's nearest until captured, 🗿 Ruins pay a one-time hoard of silver then crumble to
            dirt, and a 🗼 Watchtower reveals any rival you're bordering for free, no scouting required.
          </>
        ),
      },
    ],
  },
  {
    name: "Kingdoms & Diplomacy",
    items: [
      {
        icon: "💻",
        title: "Kingdoms & sectors",
        body: (
          <>
            Well-known tickers belong to a sector: 💻 Technology, 🏦 Finance, 🛢️ Energy, 🛒 Consumer, ⚙️ Industrial, or 📊
            Index. Win with a Technology pick and bank an extra tile; win with Finance or Energy and earn bonus silver on
            top of the normal reward. Rack up enough wins in one kingdom to become a Specialist, and the top guild in each
            kingdom holds its Council Seat &mdash; a standing discount on scouting.
          </>
        ),
      },
      {
        icon: "🤝",
        title: "Alliances",
        body: (
          <>
            Propose a non-aggression pact with a rival &mdash; while allied, your territories can never trigger a border
            duel against each other. Either leader can break it at any time.
          </>
        ),
      },
      {
        icon: "🎲",
        title: "Wagers",
        body: (
          <>
            Challenge a rival guild to stake silver on whose call performs better this round. Both leaders must accept for
            the wager to ride; the loser's silver goes straight to the winner when the round resolves.
          </>
        ),
      },
      {
        icon: "🔭",
        title: "Scouting",
        body: (
          <>
            Pay silver to reveal a rival's locked-in call &mdash; ticker, sector, and live price &mdash; to you alone for
            the rest of the round. A Council Seat discounts the cost; a Spyglass from the Market reveals every rival at
            once for less than scouting them one by one.
          </>
        ),
      },
    ],
  },
  {
    name: "The Market",
    items: [
      {
        icon: "🏪",
        title: "Spend your silver",
        body: (
          <>
            Silver isn't just for scouting and bridges &mdash; your guild menu's Market tab lets the leader buy a field
            outright, a Spyglass (scout every rival at once), a Herald's Favor (reroll your flag), or a custom Guild Title
            shown under your name. Prices rise the more you buy in a season, so spend with intent.
          </>
        ),
      },
    ],
  },
  {
    name: "Silver, Gold & the Season",
    items: [
      {
        icon: "🪙",
        title: "Silver & gold",
        body: (
          <>
            Every round, whoever holds strictly the most territory earns 3 silver &mdash; a tie means no clear leader, so
            nobody's paid. At the end of each season, the season's territorial leader earns 1 gold (worth 100 silver). A
            bigger guild's payout grows with its roster, but slower than headcount &mdash; a solo warband keeps every coin
            it earns.
          </>
        ),
      },
      {
        icon: "⏳",
        title: "The season ends",
        body: (
          <>
            Each season runs a fixed number of rounds. Whoever holds the most land when it ends earns the season's gold
            coin, then the map is wiped clean and a new season begins &mdash; though your silver, titles, and Hall of Fame
            standing all carry over.
          </>
        ),
      },
    ],
  },
];

function RulesContent() {
  return (
    <div className="rules-list">
      {CATEGORIES.map((category) => (
        <div key={category.name} className="rules-category">
          <h3 className="rules-category__name">{category.name}</h3>
          {category.items.map((item) => (
            <div className="rules-item" key={item.title}>
              <span className="rules-item__icon">{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function RulesScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="parchment-screen">
      <div className="parchment-card parchment-card--wide parchment-card--rules">
        <h2>The Laws of the Realm</h2>
        <RulesContent />
        <button className="parchment-card__cta" onClick={onContinue}>
          I understand — let me choose my path
        </button>
      </div>
    </div>
  );
}

/** The same rules, reachable mid-game as a dismissable overlay (see the
 * header's 📜 Rules button) instead of only once at onboarding. */
export function RulesModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="rules-modal-overlay" onClick={onClose}>
      <div className="parchment-card parchment-card--wide parchment-card--rules rules-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rules-modal__close" onClick={onClose} aria-label="Close rules">
          ×
        </button>
        <h2>The Laws of the Realm</h2>
        <RulesContent />
      </div>
    </div>
  );
}
