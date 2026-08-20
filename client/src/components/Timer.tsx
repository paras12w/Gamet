import { useEffect, useState } from "react";
import type { GameStateSnapshot } from "../types";
import { Hourglass } from "./icons";

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Timer({ snapshot }: { snapshot: GameStateSnapshot }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const total = snapshot.roundEndsAt - snapshot.roundStartedAt;
  const remaining = snapshot.roundEndsAt - now;
  const fraction = total > 0 ? remaining / total : 0;
  const urgent = remaining > 0 && remaining <= 15000;

  return (
    <div className={urgent ? "panel timer-panel timer-panel--urgent" : "panel timer-panel"}>
      <Hourglass fraction={fraction} size={92} />
      <div className="timer-panel__clock">{formatClock(remaining)}</div>
      <div className="timer-panel__meta">
        <span>ROUND {snapshot.roundNumber}/{snapshot.sessionRounds}</span>
        <span>SESSION #{snapshot.sessionNumber}</span>
      </div>
      <span className={snapshot.marketOpen ? "badge badge--open" : "badge badge--closed"}>
        {snapshot.marketOpen ? "● MARKET OPEN" : "○ MARKET CLOSED — SIMULATED"}
      </span>
    </div>
  );
}
