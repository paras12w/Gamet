import { useEffect, useState } from "react";
import type { GameStateSnapshot } from "../types";

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

  const remaining = snapshot.roundEndsAt - now;

  return (
    <div className="timer">
      <div className="timer__clock">{formatClock(remaining)}</div>
      <div className="timer__meta">
        <span>ROUND {snapshot.roundNumber}/{snapshot.sessionRounds}</span>
        <span>SESSION #{snapshot.sessionNumber}</span>
        <span className={snapshot.marketOpen ? "badge badge--open" : "badge badge--closed"}>
          {snapshot.marketOpen ? "● MARKET OPEN" : "○ MARKET CLOSED — SIMULATED"}
        </span>
      </div>
    </div>
  );
}
