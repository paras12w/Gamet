import { useEffect, useRef, useState } from "react";
import type { Identity } from "./types";
import { placeTile } from "./api";
import { useGameSocket } from "./hooks/useGameSocket";
import { useToasts } from "./hooks/useToasts";
import { useSound } from "./hooks/useSound";
import { UsernameScreen } from "./components/UsernameScreen";
import { RulesScreen } from "./components/RulesScreen";
import { ModeSelectScreen } from "./components/ModeSelectScreen";
import { TickerTape } from "./components/TickerTape";
import { Timer } from "./components/Timer";
import { GridView } from "./components/GridView";
import { GuildBar } from "./components/GuildBar";
import { GuildMenu } from "./components/GuildMenu";
import { Leaderboard } from "./components/Leaderboard";
import { RoundLog } from "./components/RoundLog";
import { ToastStack } from "./components/ToastStack";
import { MiniMap } from "./components/MiniMap";
import { HallOfFame } from "./components/HallOfFame";
import { GlobalChat } from "./components/GlobalChat";

const STORAGE_KEY = "gamet:identity";

type MobileTab = "board" | "guild" | "rankings" | "chat";

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
  const { snapshot, connected, chatMessages } = useGameSocket();
  const { muted, toggleMuted, play } = useSound();
  const [identity, setIdentityState] = useState<Identity>(loadIdentity);
  const { toasts, dismiss } = useToasts(snapshot, identity.guildId, play);
  const [guildMenuOpen, setGuildMenuOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("board");
  const [placementMode, setPlacementMode] = useState(false);
  const lastChatCount = useRef(0);

  async function handlePlaceTile(x: number, y: number) {
    if (!identity.guildId || !identity.leaderSecret) return;
    try {
      await placeTile(identity.guildId, identity.leaderSecret, x, y);
      play("click");
    } catch {
      play("error");
    } finally {
      setPlacementMode(false);
    }
  }

  function handleTogglePlacement() {
    setPlacementMode((prev) => {
      const next = !prev;
      if (next) setMobileTab("board");
      return next;
    });
  }

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

  // Play a soft chime for an incoming chat message from someone else.
  useEffect(() => {
    if (chatMessages.length === 0) {
      lastChatCount.current = 0;
      return;
    }
    if (chatMessages.length > lastChatCount.current) {
      const newest = chatMessages[chatMessages.length - 1];
      if (lastChatCount.current > 0 && newest.username !== identity.username && newest.guildId === identity.guildId) {
        play("chat");
      }
    }
    lastChatCount.current = chatMessages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages]);

  const inGuild = !!identity.username && !!identity.guildId;
  const spectating = !!identity.username && !identity.guildId && !!identity.spectating;

  let screen: React.ReactNode;
  if (!identity.username) {
    screen = <UsernameScreen identity={identity} setIdentity={setIdentity} />;
  } else if (!identity.rulesSeen) {
    screen = <RulesScreen onContinue={() => setIdentity({ ...identity, rulesSeen: true })} />;
  } else if (!inGuild && !spectating) {
    screen = <ModeSelectScreen snapshot={snapshot} identity={identity} setIdentity={setIdentity} />;
  } else if (snapshot) {
    screen = (
      <>
        <TickerTape snapshot={snapshot} />
        <header className="app__header">
          <div className="app__brand">GAMET</div>
          <button type="button" className="mute-toggle" onClick={toggleMuted} aria-label={muted ? "Unmute sound" : "Mute sound"}>
            {muted ? "🔇" : "🔊"}
          </button>
        </header>
        <main className="app__main">
          <div className={`app__board-pane${mobileTab === "board" ? " app__pane--active" : ""}`}>
            <GridView snapshot={snapshot} myGuildId={identity.guildId} placementMode={placementMode} onPlaceTile={handlePlaceTile} />
          </div>
          <aside className="app__sidebar">
            <Timer snapshot={snapshot} />
            <div className={`app__pane${mobileTab === "guild" ? " app__pane--active" : ""}`}>
              {inGuild ? (
                <>
                  <GuildBar
                    snapshot={snapshot}
                    identity={identity}
                    placementMode={placementMode}
                    onOpenMenu={() => setGuildMenuOpen(true)}
                    onTogglePlacement={handleTogglePlacement}
                  />
                  <MiniMap snapshot={snapshot} myGuildId={identity.guildId} />
                </>
              ) : (
                <>
                  <div className="panel spectator-panel">
                    <div className="panel__header">
                      <h2>👁️ Spectating</h2>
                    </div>
                    <p>You're watching the realm unfold without a banner of your own.</p>
                    <button type="button" className="parchment-card__cta" onClick={() => setIdentity({ ...identity, spectating: false })}>
                      Join the fray
                    </button>
                  </div>
                  <MiniMap snapshot={snapshot} myGuildId={null} />
                </>
              )}
            </div>
            <div className={`app__pane${mobileTab === "rankings" ? " app__pane--active" : ""}`}>
              <Leaderboard snapshot={snapshot} myGuildId={identity.guildId} />
              <RoundLog snapshot={snapshot} />
              <HallOfFame snapshot={snapshot} />
            </div>
            <div className={`app__pane${mobileTab === "chat" ? " app__pane--active" : ""}`}>
              <GlobalChat chatMessages={chatMessages} username={identity.username} />
            </div>
          </aside>
        </main>
        <nav className="mobile-tabbar">
          <button type="button" className={mobileTab === "board" ? "active" : ""} onClick={() => setMobileTab("board")}>
            <span className="mobile-tabbar__icon">🗺️</span>Board
          </button>
          <button type="button" className={mobileTab === "guild" ? "active" : ""} onClick={() => setMobileTab("guild")}>
            <span className="mobile-tabbar__icon">🏳️</span>{inGuild ? "Guild" : "You"}
          </button>
          <button type="button" className={mobileTab === "rankings" ? "active" : ""} onClick={() => setMobileTab("rankings")}>
            <span className="mobile-tabbar__icon">🏆</span>Ranks
          </button>
          <button type="button" className={mobileTab === "chat" ? "active" : ""} onClick={() => setMobileTab("chat")}>
            <span className="mobile-tabbar__icon">💬</span>Chat
          </button>
        </nav>
        {guildMenuOpen && inGuild && (
          <GuildMenu
            snapshot={snapshot}
            identity={identity}
            chatMessages={chatMessages}
            onClose={() => setGuildMenuOpen(false)}
            onLeave={() => {
              setGuildMenuOpen(false);
              setIdentity({ ...identity, guildId: null, leaderSecret: null });
            }}
          />
        )}
      </>
    );
  } else {
    screen = <div className="conn-banner conn-banner--full">Riding to the front lines…</div>;
  }

  return (
    <div className="app">
      {!connected && <div className="conn-banner">Reconnecting to the exchange…</div>}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {screen}
    </div>
  );
}
