import type { WebSocket, WebSocketServer } from "ws";
import type { ChatMessage, GameStateSnapshot } from "./types.js";

function broadcast(wss: WebSocketServer, payload: string): void {
  for (const client of wss.clients as Set<WebSocket>) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

export function broadcastState(wss: WebSocketServer, snapshot: GameStateSnapshot): void {
  broadcast(wss, JSON.stringify({ type: "state", snapshot }));
}

export function broadcastChat(wss: WebSocketServer, message: ChatMessage): void {
  broadcast(wss, JSON.stringify({ type: "chat", message }));
}
