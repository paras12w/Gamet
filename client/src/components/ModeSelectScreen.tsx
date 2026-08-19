import { useEffect, useState } from "react";
import type { FlagOptions, GameStateSnapshot, Identity } from "../types";
import { createGuild, getFlagOptions, joinGuild } from "../api";
import { GuildFlagBuilder } from "./GuildFlagBuilder";
import { FlagBadge } from "./icons";

type View = "choose" | "join" | "create";

export function ModeSelectScreen({
  snapshot,
  identity,
  setIdentity,
}: {
  snapshot: GameStateSnapshot | null;
  identity: Identity;
  setIdentity: (i: Identity) => void;
}) {
  const [view, setView] = useState<View>("choose");
  const [flagOptions, setFlagOptions] = useState<FlagOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [guildName, setGuildName] = useState("");
  const [color, setColor] = useState("");
  const [decal, setDecal] = useState("");

  useEffect(() => {
    getFlagOptions()
      .then((opts) => {
        setFlagOptions(opts);
        setColor((c) => c || opts.colors[Math.floor(Math.random() * opts.colors.length)]);
        setDecal((d) => d || opts.decals[Math.floor(Math.random() * opts.decals.length)]);
      })
      .catch(() => {
        /* create-guild view will just use server defaults if this fails */
      });
  }, []);

  async function playSolo() {
    setBusy(true);
    setError(null);
    try {
      const { guildId, leaderSecret } = await createGuild(`${identity.username}'s Warband`, identity.username);
      setIdentity({ ...identity, guildId, leaderSecret });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start solo campaign");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGuild(e: React.FormEvent) {
    e.preventDefault();
    if (!guildName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { guildId, leaderSecret } = await createGuild(guildName, identity.username, color, decal);
      setIdentity({ ...identity, guildId, leaderSecret });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to found guild");
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

  if (view === "join") {
    const guilds = snapshot?.guilds.filter((g) => g.alive) ?? [];
    return (
      <div className="parchment-screen">
        <div className="parchment-card parchment-card--wide">
          <button className="link-button link-button--back" onClick={() => setView("choose")}>
            &larr; back
          </button>
          <h2>Join a Guild</h2>
          <p className="parchment-card__sub">Pledge yourself to an existing banner.</p>
          <div className="guild-list">
            {guilds.map((g) => (
              <div key={g.id} className="guild-list__row">
                <FlagBadge color={g.color} decal={g.flagDecal} size={30} />
                <div className="guild-list__info">
                  <span className="guild-list__name">{g.name}</span>
                  <span className="guild-list__meta">
                    {g.squareCount} fields &middot; led by {g.leaderUsername}
                  </span>
                </div>
                <button disabled={busy} onClick={() => handleJoinGuild(g.id)}>
                  Join
                </button>
              </div>
            ))}
            {guilds.length === 0 && <div className="empty-hint">No guilds have been founded yet — be the first.</div>}
          </div>
          {error && <div className="form-error">{error}</div>}
        </div>
      </div>
    );
  }

  if (view === "create") {
    return (
      <div className="parchment-screen">
        <form className="parchment-card parchment-card--wide" onSubmit={handleCreateGuild}>
          <button type="button" className="link-button link-button--back" onClick={() => setView("choose")}>
            &larr; back
          </button>
          <h2>Found a Guild</h2>
          <p className="parchment-card__sub">Raise your banner. You'll lead this guild as its founder.</p>
          {flagOptions && (
            <GuildFlagBuilder
              options={flagOptions}
              name={guildName}
              color={color}
              decal={decal}
              onNameChange={setGuildName}
              onColorChange={setColor}
              onDecalChange={setDecal}
            />
          )}
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="parchment-card__cta" disabled={busy || !guildName.trim()}>
            {busy ? "Raising banner…" : "Found this guild"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="parchment-screen">
      <div className="parchment-screen__brand">
        <h1>Choose Your Path</h1>
        <p>Welcome, {identity.username}.</p>
      </div>
      <div className="mode-grid">
        <button className="mode-card" onClick={playSolo} disabled={busy}>
          <span className="mode-card__icon">🗡️</span>
          <h3>Play Solo</h3>
          <p>Strike out alone. You lead a lone warband, no allies to share the gains &mdash; or the risk.</p>
        </button>
        <button className="mode-card" onClick={() => setView("join")} disabled={busy}>
          <span className="mode-card__icon">🤝</span>
          <h3>Join a Guild</h3>
          <p>Pledge to an existing banner and fight alongside a guild already claiming ground.</p>
        </button>
        <button className="mode-card" onClick={() => setView("create")} disabled={busy}>
          <span className="mode-card__icon">🏳️</span>
          <h3>Found a Guild</h3>
          <p>Raise your own banner, choose its colors and emblem, and lead others into the field.</p>
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
