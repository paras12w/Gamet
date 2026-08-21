import { useEffect, useRef, useState } from "react";
import type { Identity } from "./types";
import { buyBridgeTile, placeTile } from "./api";
import { bandWord } from "./lib/warband";
import { useGameSocket } from "./hooks/useGameSocket";
import { useToasts } from "./hooks/useToasts";
import { useSound } from "./hooks/useSound";
import { UsernameScreen } from "./components/UsernameScreen";
import { RulesModal, RulesScreen } from "./components/RulesScreen";
import { ModeSelectScreen } from "./components/ModeSelectScreen";
import { TickerTape } from "./components/TickerTape";
import { Timer } from "./components/Timer";
import { GridView } from "./components/GridView";
import { GuildBar } from "./components/GuildBar";
import { GuildMenu, type GuildMenuTab } from "./components/GuildMenu";
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
  const [identity, setIdentityState] = useState<Identity>(loadIdentity);
  const { snapshot, connected, chatMessages } = useGameSocket(identity.guildId);
  const { muted, toggleMuted, play } = useSound();
  const { toasts, dismiss } = useToasts(snapshot, identity.guildId, play, chatMessages);
  const [guildMenuOpen, setGuildMenuOpen] = useState(false);
  const [guildMenuTab, setGuildMenuTab] = useState<GuildMenuTab>("overview");
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
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

  async function handleBuyBridge(x: number, y: number) {
    if (!identity.guildId || !identity.leaderSecret) return;
    try {
      await buyBridgeTile(identity.guildId, identity.leaderSecret, x, y);
      play("click");
    } catch {
      play("error");
    }
  }

  function openGuildMenu(tab?: GuildMenuTab) {
    setGuildMenuTab(tab ?? "overview");
    setGuildMenuOpen(true);
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
  const myGuild = snapshot?.guilds.find((g) => g.id === identity.guildId);
  const spectating = !!identity.username && !identity.guildId && !!identity.spectating;
  // The sidebar always shows exactly one of these three panes. "board" (the
  // default/mobile map view) has no matching pane, so it falls back to
  // "guild" - keeping the map-first mobile entry point intact while giving
  // desktop/tablet widths a sane default instead of an empty sidebar.
  const sidebarTab = mobileTab === "board" ? "guild" : mobileTab;

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
          <div className="app__header-actions">
            <button type="button" className="rules-toggle" onClick={() => setRulesModalOpen(true)}>
              📜 Rules
            </button>
            <button type="button" className="mute-toggle" onClick={toggleMuted} aria-label={muted ? "Unmute sound" : "Mute sound"}>
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </header>
        {rulesModalOpen && <RulesModal onClose={() => setRulesModalOpen(false)} />}
        <main className="app__main">
          <div className={`app__board-pane${mobileTab === "board" ? " app__pane--active" : ""}`}>
            <GridView
              snapshot={snapshot}
              myGuildId={identity.guildId}
              placementMode={placementMode}
              onPlaceTile={handlePlaceTile}
              onBuyBridge={handleBuyBridge}
            />
          </div>
          <aside className="app__sidebar">
            <Timer snapshot={snapshot} />
            <nav className="sidebar-tabs">
              <button type="button" className={sidebarTab === "guild" ? "active" : ""} onClick={() => setMobileTab("guild")}>
                {inGuild ? `🏳️ ${bandWord(myGuild?.members.length ?? 1)}` : "👁️ You"}
              </button>
              <button type="button" className={sidebarTab === "rankings" ? "active" : ""} onClick={() => setMobileTab("rankings")}>
                🏆 Ranks
              </button>
              <button type="button" className={sidebarTab === "chat" ? "active" : ""} onClick={() => setMobileTab("chat")}>
                💬 Realm Chat
              </button>
            </nav>
            <div className={`app__pane${sidebarTab === "guild" ? " app__pane--active" : ""}`}>
              {inGuild ? (
                <>
                  <GuildBar
                    snapshot={snapshot}
                    identity={identity}
                    placementMode={placementMode}
                    onOpenMenu={openGuildMenu}
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
            <div className={`app__pane${sidebarTab === "rankings" ? " app__pane--active" : ""}`}>
              <Leaderboard snapshot={snapshot} myGuildId={identity.guildId} />
              <RoundLog snapshot={snapshot} />
              <HallOfFame snapshot={snapshot} />
            </div>
            <div className={`app__pane${sidebarTab === "chat" ? " app__pane--active" : ""}`}>
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
            setIdentity={setIdentity}
            chatMessages={chatMessages}
            initialTab={guildMenuTab}
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
