import type { WebSocket, WebSocketServer } from "ws";
import type { ChatMessage } from "./types.js";
import type { GameEngine } from "./gameEngine.js";

function broadcast(wss: WebSocketServer, payload: string): void {
  for (const client of wss.clients as Set<WebSocket>) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

// Each connection gets a snapshot tailored to the guild it identified as -
// other guilds' in-progress calls (ticker/price) are redacted unless it's
// your own guild or you've paid to scout them this round. Connections
// sharing the same guildId (multiple tabs, many spectators) share one
// computed snapshot per broadcast instead of recomputing it per socket.
export function broadcastState(wss: WebSocketServer, engine: GameEngine, guildIdByClient: Map<WebSocket, string | null>): void {
  const cache = new Map<string, string>();
  for (const client of wss.clients as Set<WebSocket>) {
    if (client.readyState !== client.OPEN) continue;
    const guildId = guildIdByClient.get(client) ?? null;
    const cacheKey = guildId ?? "\0spectator";
    let payload = cache.get(cacheKey);
    if (!payload) {
      payload = JSON.stringify({ type: "state", snapshot: engine.getSnapshot(guildId) });
      cache.set(cacheKey, payload);
    }
    client.send(payload);
  }
}

export function broadcastChat(wss: WebSocketServer, message: ChatMessage): void {
  broadcast(wss, JSON.stringify({ type: "chat", message }));
}
