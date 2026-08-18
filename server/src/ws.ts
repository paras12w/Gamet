import type { WebSocket, WebSocketServer } from "ws";
import type { GameStateSnapshot } from "./types.js";

export function broadcastState(wss: WebSocketServer, snapshot: GameStateSnapshot): void {
  const payload = JSON.stringify({ type: "state", snapshot });
  for (const client of wss.clients as Set<WebSocket>) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}
