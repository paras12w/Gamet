import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, GameStateSnapshot, Identity } from "../types";
import { getChatHistory, sendChatMessage } from "../api";
import { FlagBadge } from "./icons";

type Tab = "overview" | "members" | "chat";

export function GuildMenu({
  snapshot,
  identity,
  chatMessages,
  onClose,
  onLeave,
}: {
  snapshot: GameStateSnapshot;
  identity: Identity;
  chatMessages: ChatMessage[];
  onClose: () => void;
  onLeave: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const guild = snapshot.guilds.find((g) => g.id === identity.guildId);
  const guildId = guild?.id;

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

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !guildId) return;
    setSending(true);
    try {
      await sendChatMessage(guildId, identity.username, draft);
      setDraft("");
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
              #{rank} · {guild.squareCount} fields · {guild.tokens}🪙 · led by {guild.leaderUsername}
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
                  <span className="stat-label">Gold</span>
                  <span className="stat-value">{guild.tokens}</span>
                </div>
                <div>
                  <span className="stat-label">Members</span>
                  <span className="stat-value">{guild.members.length}</span>
                </div>
              </div>

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
