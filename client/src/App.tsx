import { useEffect, useRef, useState } from "react";
import type { Identity } from "./types";
import { buyBridgeTile, placeTile } from "./api";
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
import { ActionBar } from "./components/ActionBar";
import { RankingsModal } from "./components/RankingsModal";
import { RealmChatModal } from "./components/RealmChatModal";
import { ToastStack } from "./components/ToastStack";
import { MiniMap } from "./components/MiniMap";

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
  const [identity, setIdentityState] = useState<Identity>(loadIdentity);
  const { snapshot, connected, chatMessages } = useGameSocket(identity.guildId);
  const { muted, toggleMuted, play } = useSound();
  const { toasts, dismiss } = useToasts(snapshot, identity.guildId, play, chatMessages);
  const [guildMenuOpen, setGuildMenuOpen] = useState(false);
  const [guildMenuTab, setGuildMenuTab] = useState<GuildMenuTab>("overview");
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rankingsOpen, setRankingsOpen] = useState(false);
  const [realmChatOpen, setRealmChatOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const lastChatCount = useRef(0);

  async function handlePlaceTile(x: number, y: number) {
    if (!identity.guildId || !identity.leaderSecret) return;
    // Exit placement mode and play the confirmation sound immediately so the
    // tap feels instant - the server round-trip still happens in the
    // background, and the live socket snapshot reconciles the real result a
    // moment later. Only surface an error sound if the request actually fails.
    setPlacementMode(false);
    play("click");
    try {
      await placeTile(identity.guildId, identity.leaderSecret, x, y);
    } catch {
      play("error");
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
    setPlacementMode((prev) => !prev);
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
          <div className="app__board-pane">
            <GridView
              snapshot={snapshot}
              myGuildId={identity.guildId}
              placementMode={placementMode}
              onPlaceTile={handlePlaceTile}
              onBuyBridge={handleBuyBridge}
            />
          </div>
          {/* Deliberately just the timer, the ticker call, and one row of
              buttons - every other panel (guild details, scout/market, the
              tile bank, rankings, chat) now opens on demand instead of
              living here permanently, so this whole column stays short
              enough to sit next to (or under, on a narrow screen) the board
              without ever needing its own scroll. */}
          <aside className="app__sidebar">
            <Timer snapshot={snapshot} />
            {inGuild ? (
              <GuildBar snapshot={snapshot} identity={identity} />
            ) : (
              <div className="panel spectator-panel">
                <p>You're watching the realm unfold without a banner of your own.</p>
                <button type="button" className="parchment-card__cta" onClick={() => setIdentity({ ...identity, spectating: false })}>
                  Join the fray
                </button>
              </div>
            )}
            <ActionBar
              snapshot={snapshot}
              identity={identity}
              placementMode={placementMode}
              onOpenMenu={openGuildMenu}
              onTogglePlacement={handleTogglePlacement}
              onOpenRankings={() => setRankingsOpen(true)}
              onOpenRealmChat={() => setRealmChatOpen(true)}
            />
            <MiniMap snapshot={snapshot} myGuildId={identity.guildId} />
          </aside>
        </main>
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
        {rankingsOpen && <RankingsModal snapshot={snapshot} myGuildId={identity.guildId} onClose={() => setRankingsOpen(false)} />}
        {realmChatOpen && (
          <RealmChatModal chatMessages={chatMessages} username={identity.username} onClose={() => setRealmChatOpen(false)} />
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
