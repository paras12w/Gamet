import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, GameStateSnapshot, Identity } from "../types";
import {
  breakAlliance,
  cancelWager,
  claimLeadership,
  getChatHistory,
  proposeAlliance,
  proposeWager,
  respondAlliance,
  respondWager,
  scoutGuild,
  sendChatMessage,
  setTagline,
} from "../api";
import { FlagBadge } from "./icons";
import { ACHIEVEMENT_INFO } from "../lib/achievements";
import { SECTOR_INFO } from "../lib/sectors";
import { soundEngine } from "../lib/sound";
import { AllianceChatThread } from "./AllianceChatThread";
import { formatCoins } from "../lib/coins";
import { LiveTicker } from "./GuildBar";

type Tab = "overview" | "members" | "diplomacy" | "wagers" | "sectors" | "scouting" | "chat";

// Mirrors server/src/config.ts CONFIG.SCOUT_COST / COUNCIL_SCOUT_DISCOUNT
// defaults - same pattern as GuildBar's MAX_PENDING_TILES constant.
const SCOUT_COST = 5;
const COUNCIL_SCOUT_DISCOUNT = 2;

// The three sectors with an actual mechanical bonus - mirrors server/src/
// gameEngine.ts KINGDOM_SECTORS. Consumer/Industrial/Index are flavor-only.
const KINGDOM_SECTORS = ["tech", "finance", "energy"] as const;
const SPECIALIST_THRESHOLD = 5;

function formatFoundedAgo(createdAt: number): string {
  const ms = Date.now() - createdAt;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function GuildMenu({
  snapshot,
  identity,
  setIdentity,
  chatMessages,
  onClose,
  onLeave,
}: {
  snapshot: GameStateSnapshot;
  identity: Identity;
  setIdentity: (next: Identity) => void;
  chatMessages: ChatMessage[];
  onClose: () => void;
  onLeave: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [diploBusy, setDiploBusy] = useState<string | null>(null);
  const [diploError, setDiploError] = useState<string | null>(null);
  const [expandedAlly, setExpandedAlly] = useState<string | null>(null);
  const [wagerTarget, setWagerTarget] = useState("");
  const [wagerAmount, setWagerAmount] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [taglineDraft, setTaglineDraft] = useState<string | null>(null);
  const [taglineSaving, setTaglineSaving] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const guild = snapshot.guilds.find((g) => g.id === identity.guildId);
  const guildId = guild?.id;
  const isLeader = !!identity.leaderSecret;

  useEffect(() => {
    if (!guildId) return;
    getChatHistory(guildId)
      .then((r) => setHistory(r.messages))
      .catch(() => {
        /* chat history is a nice-to-have, fail quietly */
      });
  }, [guildId]);

  const combined = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    for (const m of history) byId.set(m.id, m);
    for (const m of chatMessages) if (m.guildId === guildId) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.at - b.at);
  }, [history, chatMessages, guildId]);

  useEffect(() => {
    if (tab === "chat") logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [combined.length, tab]);

  if (!guild) return null;

  const rank = [...snapshot.guilds].sort((a, b) => b.squareCount - a.squareCount).findIndex((g) => g.id === guild.id) + 1;
  const streakEntries = Object.entries(guild.streaks).filter(([, v]) => v > 0);

  const myWagers = snapshot.wagers.filter((w) => w.fromGuild === guild.id || w.toGuild === guild.id);
  const acceptedWagers = myWagers.filter((w) => w.status === "accepted");
  const incomingWagers = myWagers.filter((w) => w.status === "pending" && w.toGuild === guild.id);
  const outgoingWagers = myWagers.filter((w) => w.status === "pending" && w.fromGuild === guild.id);
  const eligibleWagerTargets = snapshot.guilds.filter(
    (g) => g.alive && g.id !== guild.id && !myWagers.some((w) => w.status === "pending" && (w.fromGuild === g.id || w.toGuild === g.id))
  );

  async function runDiplo(key: string, action: () => Promise<unknown>) {
    if (!guildId || !identity.leaderSecret) return;
    setDiploBusy(key);
    setDiploError(null);
    try {
      await action();
      soundEngine.play("click");
    } catch (err) {
      setDiploError(err instanceof Error ? err.message : "Diplomacy action failed");
      soundEngine.play("error");
    } finally {
      setDiploBusy(null);
    }
  }

  async function submitWagerChallenge(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(wagerAmount);
    if (!wagerTarget || !Number.isInteger(amount) || amount <= 0 || !guildId || !identity.leaderSecret) return;
    await runDiplo(`wager-propose-${wagerTarget}`, () => proposeWager(guildId, identity.leaderSecret!, wagerTarget, amount));
    setWagerTarget("");
    setWagerAmount("");
  }

  async function handleClaimLeadership() {
    if (!guildId) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const result = await claimLeadership(guildId, identity.username);
      setIdentity({ ...identity, leaderSecret: result.leaderSecret });
      soundEngine.play("click");
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Could not claim leadership");
      soundEngine.play("error");
    } finally {
      setClaiming(false);
    }
  }

  async function saveTagline() {
    if (!guildId || !identity.leaderSecret || taglineDraft === null) return;
    setTaglineSaving(true);
    try {
      await setTagline(guildId, identity.leaderSecret, taglineDraft);
      soundEngine.play("click");
      setTaglineDraft(null);
    } catch {
      /* best-effort, leave draft open on failure */
    } finally {
      setTaglineSaving(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !guildId) return;
    setSending(true);
    try {
      await sendChatMessage(guildId, identity.username, draft);
      setDraft("");
      soundEngine.play("click");
    } catch {
      /* best-effort chat, drop silently */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="guild-menu-overlay" onClick={onClose}>
      <div className="guild-menu" onClick={(e) => e.stopPropagation()}>
        <div className="guild-menu__header">
          <FlagBadge color={guild.color} decal={guild.flagDecal} size={32} />
          <div className="guild-menu__title">
            <h2>{guild.name}</h2>
            <p>
              #{rank} · {guild.squareCount} fields · {formatCoins(guild.tokens)} · led by {guild.leaderUsername}
            </p>
          </div>
          <button type="button" className="guild-menu__close" onClick={onClose} aria-label="Close guild menu">
            ×
          </button>
        </div>

        <div className="guild-menu__tabs">
          <button type="button" className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
            Overview
          </button>
          <button type="button" className={tab === "members" ? "active" : ""} onClick={() => setTab("members")}>
            Members ({guild.members.length})
          </button>
          <button type="button" className={tab === "diplomacy" ? "active" : ""} onClick={() => setTab("diplomacy")}>
            Diplomacy{guild.incomingAllianceRequests.length > 0 ? ` (${guild.incomingAllianceRequests.length})` : ""}
          </button>
          <button type="button" className={tab === "scouting" ? "active" : ""} onClick={() => setTab("scouting")}>
            Scouting
          </button>
          <button type="button" className={tab === "wagers" ? "active" : ""} onClick={() => setTab("wagers")}>
            Wagers{incomingWagers.length > 0 ? ` (${incomingWagers.length})` : ""}
          </button>
          <button type="button" className={tab === "sectors" ? "active" : ""} onClick={() => setTab("sectors")}>
            Kingdoms
          </button>
          <button type="button" className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
            Chat
          </button>
        </div>

        <div className="guild-menu__body">
          {tab === "overview" && (
            <div className="guild-menu__overview">
              <div className="guild-panel__stats">
                <div>
                  <span className="stat-label">Rank</span>
                  <span className="stat-value">#{rank}</span>
                </div>
                <div>
                  <span className="stat-label">Fields</span>
                  <span className="stat-value">{guild.squareCount}</span>
                </div>
                <div>
                  <span className="stat-label">Coin</span>
                  <span className="stat-value">{formatCoins(guild.tokens)}</span>
                </div>
                <div>
                  <span className="stat-label">Members</span>
                  <span className="stat-value">{guild.members.length}</span>
                </div>
                <div>
                  <span className="stat-label">Seasons Won</span>
                  <span className="stat-value">{guild.sessionsWon}</span>
                </div>
                <div>
                  <span className="stat-label">Conquests</span>
                  <span className="stat-value">{guild.takeovers}</span>
                </div>
              </div>

              {(guild.sessionsWon > 0 || guild.takeovers > 0) && (
                <div className="guild-menu__badges">
                  {guild.sessionsWon > 0 && (
                    <span className="achievement-badge">🏆 Season Champion{guild.sessionsWon > 1 ? ` ×${guild.sessionsWon}` : ""}</span>
                  )}
                  {guild.takeovers > 0 && (
                    <span className="achievement-badge">👑 Conqueror{guild.takeovers > 1 ? ` ×${guild.takeovers}` : ""}</span>
                  )}
                </div>
              )}

              {guild.achievements.length > 0 && (
                <>
                  <h4 className="diplomacy__section-title">Achievements</h4>
                  <div className="guild-menu__badges">
                    {guild.achievements.map((key) => {
                      const info = ACHIEVEMENT_INFO[key];
                      if (!info) return null;
                      return (
                        <span key={key} className="achievement-badge" title={info.description}>
                          {info.icon} {info.name}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}

              <p className="guild-menu__founded">Founded {formatFoundedAgo(guild.createdAt)}</p>

              {guild.leaderless && !isLeader && (
                <div className="badge badge--closed">
                  ⚠️ Our leader has gone quiet — any member can step up.
                  <button type="button" className="link-button" disabled={claiming} onClick={handleClaimLeadership}>
                    {claiming ? "Claiming…" : "Claim Leadership"}
                  </button>
                </div>
              )}
              {claimError && <div className="form-error">{claimError}</div>}

              {isLeader && (
                <div className="guild-menu__tagline-editor">
                  <label htmlFor="guild-tagline">Recruiting tagline</label>
                  <textarea
                    id="guild-tagline"
                    maxLength={80}
                    value={taglineDraft ?? guild.tagline}
                    onChange={(e) => setTaglineDraft(e.target.value)}
                    placeholder="Pitch your guild to would-be recruits…"
                  />
                  <button type="button" disabled={taglineDraft === null || taglineSaving} onClick={saveTagline}>
                    {taglineSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              )}

              {streakEntries.length > 0 && (
                <div className="guild-panel__streaks">
                  {streakEntries.map(([oppId, v]) => {
                    const opp = snapshot.guilds.find((g) => g.id === oppId);
                    return (
                      <div key={oppId} className="streak-row">
                        ⚔ {v} duel win{v > 1 ? "s" : ""} vs {opp?.name ?? "unknown"} <span className="streak-warn">(conquest at 2)</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {!guild.alive && <div className="badge badge--closed">This guild has been absorbed by a rival.</div>}

              <button type="button" className="link-button" onClick={onLeave}>
                Abandon this banner
              </button>
            </div>
          )}

          {tab === "members" && (
            <ul className="guild-menu__members">
              {guild.members.map((m) => (
                <li key={m}>
                  {m}
                  {m === guild.leaderUsername ? " 👑" : ""}
                </li>
              ))}
            </ul>
          )}

          {tab === "diplomacy" && (
            <div className="diplomacy">
              {!isLeader && <div className="empty-hint">Only your guild's leader can broker alliances.</div>}

              <h4 className="diplomacy__section-title">Our Allies</h4>
              {guild.allies.length === 0 && <div className="empty-hint">No alliances yet.</div>}
              {guild.allies.map((allyId) => {
                const ally = snapshot.guilds.find((g) => g.id === allyId);
                if (!ally) return null;
                return (
                  <div key={allyId} className="diplomacy__ally">
                    <div className="diplomacy__row">
                      <FlagBadge color={ally.color} decal={ally.flagDecal} size={20} />
                      <span className="diplomacy__name">{ally.name}</span>
                      <span className="diplomacy__actions">
                        <button
                          type="button"
                          className="diplomacy__btn"
                          onClick={() => setExpandedAlly(expandedAlly === allyId ? null : allyId)}
                        >
                          💬 {expandedAlly === allyId ? "Hide" : "Chat"}
                        </button>
                        {isLeader && (
                          <button
                            type="button"
                            className="diplomacy__btn diplomacy__btn--break"
                            disabled={diploBusy === `break-${allyId}`}
                            onClick={() => runDiplo(`break-${allyId}`, () => breakAlliance(guildId!, identity.leaderSecret!, allyId))}
                          >
                            Break
                          </button>
                        )}
                      </span>
                    </div>
                    {expandedAlly === allyId && guildId && (
                      <AllianceChatThread guildId={guildId} allyId={allyId} username={identity.username} chatMessages={chatMessages} />
                    )}
                  </div>
                );
              })}

              {guild.incomingAllianceRequests.length > 0 && (
                <>
                  <h4 className="diplomacy__section-title">Incoming Requests</h4>
                  {guild.incomingAllianceRequests.map((proposerId) => {
                    const proposer = snapshot.guilds.find((g) => g.id === proposerId);
                    if (!proposer) return null;
                    return (
                      <div key={proposerId} className="diplomacy__row">
                        <FlagBadge color={proposer.color} decal={proposer.flagDecal} size={20} />
                        <span className="diplomacy__name">{proposer.name}</span>
                        {isLeader && (
                          <span className="diplomacy__actions">
                            <button
                              type="button"
                              className="diplomacy__btn diplomacy__btn--accept"
                              disabled={diploBusy === `respond-${proposerId}`}
                              onClick={() => runDiplo(`respond-${proposerId}`, () => respondAlliance(guildId!, identity.leaderSecret!, proposerId, true))}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="diplomacy__btn"
                              disabled={diploBusy === `respond-${proposerId}`}
                              onClick={() => runDiplo(`respond-${proposerId}`, () => respondAlliance(guildId!, identity.leaderSecret!, proposerId, false))}
                            >
                              Decline
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              <h4 className="diplomacy__section-title">Rival Guilds</h4>
              {snapshot.guilds
                .filter(
                  (g) =>
                    g.alive &&
                    g.id !== guild.id &&
                    !guild.allies.includes(g.id) &&
                    !guild.outgoingAllianceRequests.includes(g.id) &&
                    !guild.incomingAllianceRequests.includes(g.id)
                )
                .map((g) => (
                  <div key={g.id} className="diplomacy__row">
                    <FlagBadge color={g.color} decal={g.flagDecal} size={20} />
                    <span className="diplomacy__name">{g.name}</span>
                    {isLeader && (
                      <button
                        type="button"
                        className="diplomacy__btn"
                        disabled={diploBusy === `propose-${g.id}`}
                        onClick={() => runDiplo(`propose-${g.id}`, () => proposeAlliance(guildId!, identity.leaderSecret!, g.id))}
                      >
                        Propose Alliance
                      </button>
                    )}
                  </div>
                ))}
              {guild.outgoingAllianceRequests.length > 0 && (
                <div className="diplomacy__pending-note">
                  Awaiting response from:{" "}
                  {guild.outgoingAllianceRequests.map((id) => snapshot.guilds.find((g) => g.id === id)?.name ?? "unknown").join(", ")}
                </div>
              )}

              {diploError && <div className="form-error">{diploError}</div>}
            </div>
          )}

          {tab === "scouting" && (
            <div className="scouting-tab">
              {(() => {
                const holdsSeat = Object.values(snapshot.sectorCouncil).includes(guild.id);
                const scoutCost = Math.max(1, SCOUT_COST - (holdsSeat ? COUNCIL_SCOUT_DISCOUNT : 0));
                const rivals = snapshot.guilds.filter((g) => g.alive && g.id !== guild.id);
                return (
                  <>
                    <p className="wagers__disclaimer">
                      🔭 Pay silver to reveal a rival's locked-in call - ticker, sector, and live price - to you alone for the rest of
                      the round. Costs {scoutCost}🪙{holdsSeat ? " (discounted - you hold a Council Seat)" : ""} per scout, once per
                      guild per round.
                    </p>
                    {!isLeader && <div className="empty-hint">Only your guild's leader can order a scout.</div>}
                    {rivals.length === 0 && <div className="empty-hint">No rival guilds on the board yet.</div>}
                    {rivals.map((g) => (
                      <div key={g.id} className="scout-row">
                        <FlagBadge color={g.color} decal={g.flagDecal} size={22} />
                        <span className="diplomacy__name">{g.name}</span>
                        <span className="scout-row__intel">
                          {g.proposalTicker ? (
                            <LiveTicker
                              ticker={g.proposalTicker}
                              startPrice={g.proposalStartPrice}
                              livePrice={g.livePrice}
                              source={g.liveSource}
                              sectorKey={g.proposalSectorKey}
                            />
                          ) : g.hasProposal ? (
                            isLeader && (
                              <button
                                type="button"
                                className="diplomacy__btn"
                                disabled={diploBusy === `scout-${g.id}`}
                                onClick={() => runDiplo(`scout-${g.id}`, () => scoutGuild(guildId!, identity.leaderSecret!, g.id))}
                              >
                                🔭 Scout ({scoutCost}🪙)
                              </button>
                            )
                          ) : (
                            <span className="scout-row__waiting">Awaiting their call…</span>
                          )}
                        </span>
                      </div>
                    ))}
                    {diploError && <div className="form-error">{diploError}</div>}
                  </>
                );
              })()}
            </div>
          )}

          {tab === "wagers" && (
            <div className="diplomacy">
              <p className="wagers__disclaimer">🪙 Wagers stake in-game silver only — never real money. A wager settles at the end of the round it's accepted in, based on whose call performed better.</p>
              {!isLeader && <div className="empty-hint">Only your guild's leader can place wagers.</div>}

              <h4 className="diplomacy__section-title">Riding This Round</h4>
              {acceptedWagers.length === 0 && <div className="empty-hint">No wagers currently riding.</div>}
              {acceptedWagers.map((w) => {
                const opponentId = w.fromGuild === guild.id ? w.toGuild : w.fromGuild;
                const opponent = snapshot.guilds.find((g) => g.id === opponentId);
                if (!opponent) return null;
                return (
                  <div key={w.id} className="diplomacy__row">
                    <FlagBadge color={opponent.color} decal={opponent.flagDecal} size={20} />
                    <span className="diplomacy__name">
                      {opponent.name} — {formatCoins(w.amount)}
                    </span>
                    <span className="wager-status">settles this round</span>
                  </div>
                );
              })}

              {incomingWagers.length > 0 && (
                <>
                  <h4 className="diplomacy__section-title">Incoming Challenges</h4>
                  {incomingWagers.map((w) => {
                    const proposer = snapshot.guilds.find((g) => g.id === w.fromGuild);
                    if (!proposer) return null;
                    return (
                      <div key={w.id} className="diplomacy__row">
                        <FlagBadge color={proposer.color} decal={proposer.flagDecal} size={20} />
                        <span className="diplomacy__name">
                          {proposer.name} — {formatCoins(w.amount)}
                        </span>
                        {isLeader && (
                          <span className="diplomacy__actions">
                            <button
                              type="button"
                              className="diplomacy__btn diplomacy__btn--accept"
                              disabled={diploBusy === `wager-respond-${w.id}`}
                              onClick={() => runDiplo(`wager-respond-${w.id}`, () => respondWager(guildId!, identity.leaderSecret!, w.id, true))}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="diplomacy__btn"
                              disabled={diploBusy === `wager-respond-${w.id}`}
                              onClick={() => runDiplo(`wager-respond-${w.id}`, () => respondWager(guildId!, identity.leaderSecret!, w.id, false))}
                            >
                              Decline
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {outgoingWagers.length > 0 && (
                <>
                  <h4 className="diplomacy__section-title">Your Challenges</h4>
                  {outgoingWagers.map((w) => {
                    const target = snapshot.guilds.find((g) => g.id === w.toGuild);
                    if (!target) return null;
                    return (
                      <div key={w.id} className="diplomacy__row">
                        <FlagBadge color={target.color} decal={target.flagDecal} size={20} />
                        <span className="diplomacy__name">
                          {target.name} — {formatCoins(w.amount)}
                        </span>
                        {isLeader && (
                          <button
                            type="button"
                            className="diplomacy__btn diplomacy__btn--break"
                            disabled={diploBusy === `wager-cancel-${w.id}`}
                            onClick={() => runDiplo(`wager-cancel-${w.id}`, () => cancelWager(guildId!, identity.leaderSecret!, w.id))}
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {isLeader && guild.tokens === 0 && (
                <>
                  <h4 className="diplomacy__section-title">Challenge a Guild</h4>
                  <div className="empty-hint">Your guild has no coin to wager yet — win a round, a season, or a wager to build up a stake.</div>
                </>
              )}

              {isLeader && guild.tokens > 0 && (
                <>
                  <h4 className="diplomacy__section-title">Challenge a Guild</h4>
                  <form className="wager-form" onSubmit={submitWagerChallenge}>
                    <select value={wagerTarget} onChange={(e) => setWagerTarget(e.target.value)}>
                      <option value="">Choose a guild…</option>
                      {eligibleWagerTargets.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={guild.tokens}
                      value={wagerAmount}
                      onChange={(e) => setWagerAmount(e.target.value)}
                      placeholder={`Silver (max ${guild.tokens})`}
                    />
                    <button type="submit" disabled={!wagerTarget || !wagerAmount || diploBusy === `wager-propose-${wagerTarget}`}>
                      Challenge
                    </button>
                  </form>
                </>
              )}

              {diploError && <div className="form-error">{diploError}</div>}
            </div>
          )}

          {tab === "sectors" && (
            <div className="sectors-tab">
              {snapshot.activeContract && (
                <div className="sector-contract">
                  <span className="sector-contract__icon">{SECTOR_INFO[snapshot.activeContract.sectorKey]?.icon ?? "📜"}</span>
                  <div>
                    <h4>Realm Contract</h4>
                    <p>
                      First guild to win <strong>{snapshot.activeContract.target}</strong>{" "}
                      {SECTOR_INFO[snapshot.activeContract.sectorKey]?.name ?? snapshot.activeContract.sectorKey} calls claims{" "}
                      <strong>{formatCoins(snapshot.activeContract.reward)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {KINGDOM_SECTORS.map((key) => {
                const info = SECTOR_INFO[key];
                const wins = guild.sectorWins[key] ?? 0;
                const isSpecialist = wins >= SPECIALIST_THRESHOLD;
                const seatHolderId = snapshot.sectorCouncil[key];
                const seatHolder = seatHolderId ? snapshot.guilds.find((g) => g.id === seatHolderId) : null;
                const youHoldSeat = seatHolderId === guild.id;
                return (
                  <div key={key} className="sector-card">
                    <div className="sector-card__header">
                      <span className="sector-card__icon">{info.icon}</span>
                      <h4>{info.name}</h4>
                      {youHoldSeat && <span className="sector-card__seat-badge">👑 You lead this kingdom</span>}
                    </div>
                    <p className="sector-card__wins">
                      {wins} win{wins === 1 ? "" : "s"} {isSpecialist && <span className="sector-card__specialist">★ Specialist</span>}
                    </p>
                    <div className="sector-card__bar">
                      <div className="sector-card__bar-fill" style={{ width: `${Math.min(100, (wins / SPECIALIST_THRESHOLD) * 100)}%` }} />
                    </div>
                    <p className="sector-card__hint">
                      {isSpecialist
                        ? key === "tech"
                          ? "Specialist bonus active: +1 extra tile on every Tech win."
                          : "Specialist bonus active: +2 extra silver on every win here."
                        : `${SPECIALIST_THRESHOLD - wins} more win${SPECIALIST_THRESHOLD - wins === 1 ? "" : "s"} to unlock a permanent bonus.`}
                    </p>
                    <p className="sector-card__council">
                      {seatHolder ? (
                        <>
                          👑 Council seat: <strong>{seatHolder.name}</strong> ({seatHolder.sectorWins[key] ?? 0} wins) — scouts{" "}
                          {SCOUT_COST - 2} 🪙 instead of {SCOUT_COST} 🪙
                        </>
                      ) : (
                        "👑 Council seat: vacant — be the first to win here"
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "chat" && (
            <div className="guild-menu__chat">
              <div className="guild-menu__chat-log" ref={logRef}>
                {combined.length === 0 && <div className="empty-hint">No messages yet — say something to your guild.</div>}
                {combined.map((m) => (
                  <div key={m.id} className="chat-message">
                    <span className="chat-message__author">{m.username}:</span>{" "}
                    <span className="chat-message__text">{m.text}</span>
                  </div>
                ))}
              </div>
              <form className="guild-menu__chat-form" onSubmit={sendMessage}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message your guild…" maxLength={300} />
                <button type="submit" disabled={sending || !draft.trim()}>
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
