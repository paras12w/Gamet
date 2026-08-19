import { useEffect, useState } from "react";
import type { Identity } from "./types";
import { useGameSocket } from "./hooks/useGameSocket";
import { UsernameScreen } from "./components/UsernameScreen";
import { RulesScreen } from "./components/RulesScreen";
import { ModeSelectScreen } from "./components/ModeSelectScreen";
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
    if (raw) return { rulesSeen: false, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt storage */
  }
  return { username: "", guildId: null, leaderSecret: null, rulesSeen: false };
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

  let screen: React.ReactNode;
  if (!identity.username) {
    screen = <UsernameScreen identity={identity} setIdentity={setIdentity} />;
  } else if (!identity.rulesSeen) {
    screen = <RulesScreen onContinue={() => setIdentity({ ...identity, rulesSeen: true })} />;
  } else if (!inGuild) {
    screen = <ModeSelectScreen snapshot={snapshot} identity={identity} setIdentity={setIdentity} />;
  } else if (snapshot) {
    screen = (
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
    );
  } else {
    screen = <div className="conn-banner conn-banner--full">Riding to the front lines…</div>;
  }

  return (
    <div className="app">
      {!connected && <div className="conn-banner">Reconnecting to the exchange…</div>}
      {screen}
    </div>
  );
}
