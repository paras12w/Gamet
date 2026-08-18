import { useState } from "react";
import type { GameStateSnapshot, Identity } from "../types";
import { createGuild, joinGuild } from "../api";

export function JoinScreen({
  snapshot,
  identity,
  setIdentity,
}: {
  snapshot: GameStateSnapshot | null;
  identity: Identity;
  setIdentity: (i: Identity) => void;
}) {
  const [username, setUsername] = useState(identity.username);
  const [guildName, setGuildName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasUsername = !!identity.username;

  function submitUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setIdentity({ username: username.trim(), guildId: null, leaderSecret: null });
  }

  async function handleCreateGuild(e: React.FormEvent) {
    e.preventDefault();
    if (!guildName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { guildId, leaderSecret } = await createGuild(guildName, identity.username);
      setIdentity({ ...identity, guildId, leaderSecret });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create guild");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinGuild(guildId: string) {
    setBusy(true);
    setError(null);
    try {
      await joinGuild(guildId, identity.username);
      setIdentity({ ...identity, guildId, leaderSecret: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join guild");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="join-screen">
      <div className="join-screen__brand">
        <h1>GAMET</h1>
        <p>An empire built on calls, not luck.</p>
      </div>

      {!hasUsername ? (
        <form className="join-card" onSubmit={submitUsername}>
          <h2>Enter the floor</h2>
          <label htmlFor="username">Trader name</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. wolf_of_wallst" maxLength={30} autoFocus />
          <button type="submit" disabled={!username.trim()}>
            Continue
          </button>
        </form>
      ) : (
        <div className="join-card join-card--wide">
          <h2>Welcome, {identity.username}</h2>
          <p className="join-card__sub">Found a guild or join an active one.</p>

          <form onSubmit={handleCreateGuild} className="join-card__create">
            <input value={guildName} onChange={(e) => setGuildName(e.target.value)} placeholder="Guild name" maxLength={40} />
            <button type="submit" disabled={busy || !guildName.trim()}>
              Found guild (become leader)
            </button>
          </form>

          {error && <div className="form-error">{error}</div>}

          <div className="join-card__list">
            {snapshot?.guilds.filter((g) => g.alive).map((g) => (
              <div key={g.id} className="join-card__list-row">
                <span className="swatch" style={{ background: g.color }} />
                <span>{g.name}</span>
                <span className="join-card__list-meta">{g.squareCount} sq · led by {g.leaderUsername}</span>
                <button disabled={busy} onClick={() => handleJoinGuild(g.id)}>
                  Join
                </button>
              </div>
            ))}
            {(!snapshot || snapshot.guilds.length === 0) && <div className="empty-hint">No guilds yet — found the first one.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
