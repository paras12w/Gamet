import { useEffect, useState } from "react";
import type { Identity } from "./types";
import { useGameSocket } from "./hooks/useGameSocket";
import { JoinScreen } from "./components/JoinScreen";
import { TickerTape } from "./components/TickerTape";
import { Timer } from "./components/Timer";
import { GridView } from "./components/GridView";
import { GuildPanel } from "./components/GuildPanel";
import { Leaderboard } from "./components/Leaderboard";
import { RoundLog } from "./components/RoundLog";

const STORAGE_KEY = "gamet:identity";

function loadIdentity(): Identity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore corrupt storage */
  }
  return { username: "", guildId: null, leaderSecret: null };
}

export default function App() {
  const { snapshot, connected } = useGameSocket();
  const [identity, setIdentityState] = useState<Identity>(loadIdentity);

  const setIdentity = (next: Identity) => {
    setIdentityState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  // If our guild vanished (server restart during dev), fall back to the lobby.
  useEffect(() => {
    if (!snapshot || !identity.guildId) return;
    const stillExists = snapshot.guilds.some((g) => g.id === identity.guildId);
    if (!stillExists) setIdentity({ ...identity, guildId: null, leaderSecret: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  const inGuild = !!identity.username && !!identity.guildId;

  return (
    <div className="app">
      {!connected && <div className="conn-banner">Reconnecting to the exchange…</div>}

      {snapshot && inGuild ? (
        <>
          <TickerTape snapshot={snapshot} />
          <header className="app__header">
            <div className="app__brand">GAMET</div>
            <Timer snapshot={snapshot} />
          </header>
          <main className="app__main">
            <GridView snapshot={snapshot} myGuildId={identity.guildId} />
            <aside className="app__sidebar">
              <GuildPanel snapshot={snapshot} identity={identity} onLeave={() => setIdentity({ ...identity, guildId: null, leaderSecret: null })} />
              <Leaderboard snapshot={snapshot} myGuildId={identity.guildId} />
              <RoundLog snapshot={snapshot} />
            </aside>
          </main>
        </>
      ) : (
        <JoinScreen snapshot={snapshot} identity={identity} setIdentity={setIdentity} />
      )}
    </div>
  );
}
