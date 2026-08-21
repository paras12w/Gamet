import { useEffect, useRef, useState } from "react";
import type { ChatMessage, GameStateSnapshot } from "../types";
import type { SoundName } from "../lib/sound";

export interface Toast {
  id: string;
  text: string;
  kind: "success" | "info" | "danger";
}

const HERALD_NAME = "📯 Herald";

/** Watches the snapshot for big moments (takeovers, a season ending, your
 * own guild's round outcome) and turns them into transient toasts plus a
 * matching sound cue. Skips whatever state already existed on the first
 * snapshot received, so joining mid-session doesn't dredge up stale events.
 * Also watches chat for system ("Herald") messages addressed to your own
 * guild's channel - this is how alliance and wager events surface, without
 * needing a dedicated snapshot field per event type. */
export function useToasts(
  snapshot: GameStateSnapshot | null,
  myGuildId: string | null,
  playSound: (name: SoundName) => void,
  chatMessages: ChatMessage[] = []
) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const initialized = useRef(false);
  const seenRoundKey = useRef<string | null>(null);
  const seenWinnerKey = useRef<string | null>(null);
  const seenChatIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!snapshot) return;
    const roundKey = `${snapshot.sessionNumber}-${snapshot.roundNumber}`;
    const winnerKey = snapshot.lastSessionWinner ? `${snapshot.sessionNumber}-${snapshot.lastSessionWinner.guildId}` : null;

    if (!initialized.current) {
      initialized.current = true;
      seenRoundKey.current = roundKey;
      seenWinnerKey.current = winnerKey;
      return;
    }

    const fresh: Toast[] = [];
    if (seenRoundKey.current !== roundKey) {
      seenRoundKey.current = roundKey;
      for (const r of snapshot.lastRoundResults) {
        if (r.outcome === "takeover_win") {
          fresh.push({ id: `${roundKey}-${r.guildId}`, kind: "success", text: `👑 ${r.guildName} conquered a rival guild!` });
          playSound("takeover");
        }
        if (r.guildId === myGuildId) {
          if (r.outcome === "expanded") playSound("expand");
          else if (r.outcome === "battle_won") playSound("battleWin");
          else if (r.outcome === "battle_lost" || r.outcome === "battle_forfeit" || r.outcome === "takeover_lost") playSound("battleLose");

          if (r.topCaller && r.tileOutcome) {
            fresh.push({
              id: `${roundKey}-${r.guildId}-top-caller`,
              kind: "success",
              text: `🥇 Best call of the round! +${r.tilesGranted} tiles ${r.tileOutcome === "banked" ? "banked" : "earned"}.`,
            });
            playSound("battleWin");
          }

          if (r.tileOutcome === "destroyed") {
            fresh.push({
              id: `${roundKey}-${r.guildId}-tile-lost`,
              kind: "danger",
              text: r.topCaller
                ? "🔥 Your tile bank was nearly full — some of this round's top-call bonus tiles were destroyed!"
                : "🔥 Your tile bank was already full (5/5) — this round's earned tile was destroyed!",
            });
            playSound("error");
          }
        }
      }
    }
    if (winnerKey && seenWinnerKey.current !== winnerKey) {
      seenWinnerKey.current = winnerKey;
      fresh.push({ id: `winner-${winnerKey}`, kind: "success", text: `🏆 ${snapshot.lastSessionWinner!.guildName} claimed the season's crown!` });
      playSound("sessionWin");
    }
    if (fresh.length) setToasts((prev) => [...prev, ...fresh].slice(-5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  useEffect(() => {
    if (!seenChatIds.current) {
      // First run: remember whatever's already in the buffer without toasting it.
      seenChatIds.current = new Set(chatMessages.map((m) => m.id));
      return;
    }
    if (!myGuildId) return;
    const fresh: Toast[] = [];
    for (const m of chatMessages) {
      if (seenChatIds.current.has(m.id)) continue;
      seenChatIds.current.add(m.id);
      if (m.guildId === myGuildId && m.username === HERALD_NAME) {
        fresh.push({ id: `herald-${m.id}`, kind: "info", text: m.text });
      }
    }
    if (fresh.length) {
      setToasts((prev) => [...prev, ...fresh].slice(-5));
      playSound("herald");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, myGuildId]);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 6000));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  return { toasts, dismiss };
}
