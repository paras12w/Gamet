import type { GameStateSnapshot, RoundHistoryEntry, RoundResultEntry } from "../types";
import { SECTOR_INFO } from "../lib/sectors";

const OUTCOME_LABEL: Record<RoundResultEntry["outcome"], string> = {
  expanded: "🌱 claimed new ground",
  no_change: "held their ground — no gain",
  battle_won: "⚔️ won the duel",
  battle_lost: "⚔️ lost the duel",
  battle_tied: "⚔️ duel tied — no ground taken",
  battle_forfeit: "⚔️ forfeited the duel (no call)",
  no_proposal: "sat out this round",
  takeover_win: "👑 CONQUEST — the rival guild falls!",
  takeover_lost: "💀 conquered by a rival guild",
};

function tileOutcomeLabel(r: RoundResultEntry): string | null {
  if (!r.tileOutcome) return null;
  // r.topCaller (not tilesGranted > 1!) is the only reliable signal - a
  // sector bonus can also push tilesGranted above 1 for a guild that
  // wasn't the round's actual best-performing call.
  if (r.tileOutcome === "banked") {
    return r.topCaller
      ? ` · 🥇 top call — ${r.tilesGranted} tiles banked!`
      : (r.tilesGranted ?? 1) > 1
        ? ` · 🎒 ${r.tilesGranted} tiles banked`
        : " · 🎒 tile banked";
  }
  return r.topCaller
    ? ` · 🔥 top call, but the bank overflowed — some tiles destroyed`
    : " · 🔥 tile destroyed (bank full)";
}

function sectorLabel(r: RoundResultEntry): string | null {
  if (!r.sectorKey) return null;
  const sector = SECTOR_INFO[r.sectorKey];
  if (!sector) return null;
  return r.sectorSilverBonus ? ` · ${sector.icon} ${sector.name} kingdom bonus — +${r.sectorSilverBonus} silver` : ` · ${sector.icon} ${sector.name} kingdom`;
}

// Deterministic flavor lines for the outcomes worth dramatizing. Picked by a
// hash of the round/guild/outcome so the same event always reads the same
// way on re-render, without needing the server to generate or store text.
const FLAVOR: Partial<Record<RoundResultEntry["outcome"], string[]>> = {
  expanded: [
    "{g}'s scouts stake new ground before dawn.",
    "{g}'s banners push the border outward.",
    "{g} claims another field for the crown.",
    "{g}'s surveyors plant a fresh stake at the treeline.",
  ],
  battle_won: [
    "{g}'s knights hold the line and push through.",
    "{g}'s spears win the day at the border.",
    "{g} routs the rival guard at the fence line.",
    "{g}'s vanguard breaks the enemy shield wall.",
  ],
  battle_lost: [
    "{g}'s line buckles and gives ground.",
    "{g}'s outriders are driven back from the border.",
    "{g} loses the field after a hard-fought skirmish.",
  ],
  takeover_win: [
    "{g}'s banners rise over the rival's shattered gates. Total conquest.",
    "{g} storms the last wall — the rival guild kneels.",
    "{g}'s war-host leaves nothing standing. Conquest complete.",
    "{g} accepts the rival's surrender. Their lands are ours now.",
  ],
  takeover_lost: [
    "The gates fall. {g}'s banner is torn down.",
    "{g}'s halls are put to the torch. The guild is no more.",
    "{g}'s last stand fails. Their lands change hands.",
  ],
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function flavorFor(round: RoundHistoryEntry, r: RoundResultEntry): string | null {
  const lines = FLAVOR[r.outcome];
  if (!lines || lines.length === 0) return null;
  const seed = `${round.sessionNumber}-${round.roundNumber}-${r.guildId}-${r.outcome}`;
  const idx = hashStr(seed) % lines.length;
  return lines[idx].replace("{g}", r.guildName);
}

export function RoundLog({ snapshot }: { snapshot: GameStateSnapshot }) {
  // The server's roundHistory is capped by count (ROUND_HISTORY_LIMIT), not
  // by session - early in a fresh session that cap can still hold leftover
  // entries from whatever session came before it. Trim to just the current
  // session here so the feed only ever shows "this session's" calls.
  const rounds = snapshot.roundHistory.filter((r) => r.sessionNumber === snapshot.sessionNumber).reverse();

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Battle History</h2>
      </div>
      <p className="round-log__disclaimer">
        Only the round's top gainer is public - everyone else's moves stay quiet, so a sneak attack is always on the table.
      </p>
      <div className="round-log round-log--scroll">
        {rounds.length === 0 && <div className="empty-hint">Results appear once the first round resolves.</div>}
        {rounds.map((round) => (
          <div key={`${round.sessionNumber}-${round.roundNumber}`} className="round-log__group">
            <div className="round-log__group-header">
              Round {round.roundNumber} <span>· Session {round.sessionNumber}</span>
            </div>
            {round.results.length === 0 && <div className="empty-hint">No public gains this round.</div>}
            {round.results.map((r, i) => {
              const up = r.pctChange !== null && r.pctChange >= 0;
              const flavor = flavorFor(round, r);
              return (
                <div key={i} className="round-log__entry">
                  <div className="round-log__row">
                    <span className="round-log__guild">{r.guildName}</span>
                    {r.ticker && (
                      <span className={up ? "pct pct--up" : "pct pct--down"}>
                        {r.ticker} {up ? "▲" : "▼"} {(Math.abs(r.pctChange ?? 0) * 100).toFixed(2)}%
                      </span>
                    )}
                    <span className="round-log__outcome">
                      {OUTCOME_LABEL[r.outcome]}
                      {tileOutcomeLabel(r)}
                      {sectorLabel(r)}
                    </span>
                  </div>
                  {flavor && <p className="round-log__flavor">{flavor}</p>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
