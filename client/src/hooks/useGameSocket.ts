import { useEffect, useRef, useState } from "react";
import type { ChatMessage, GameStateSnapshot } from "../types";

const CHAT_BUFFER_LIMIT = 300;

/** guildId drives snapshot redaction server-side: other guilds' in-progress
 * calls are hidden unless it's your own guild or you've scouted them, so the
 * socket has to tell the server who it is (and re-tell it whenever guildId
 * changes - joining, founding, or leaving a guild). */
export function useGameSocket(guildId: string | null) {
  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const retryDelay = useRef(1000);
  const socketRef = useRef<WebSocket | null>(null);
  const guildIdRef = useRef(guildId);
  guildIdRef.current = guildId;

  useEffect(() => {
    let socket: WebSocket;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws`);
      socketRef.current = socket;

      socket.onopen = () => {
        retryDelay.current = 1000;
        setConnected(true);
        socket.send(JSON.stringify({ type: "identify", guildId: guildIdRef.current }));
      };
      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "state") setSnapshot(msg.snapshot);
        else if (msg.type === "chat") setChatMessages((prev) => [...prev, msg.message].slice(-CHAT_BUFFER_LIMIT));
      };
      socket.onclose = () => {
        setConnected(false);
        // Guard against a superseded socket's delayed close event (e.g. React
        // StrictMode's dev-only double-mount) clobbering the ref to a newer,
        // still-live connection.
        if (socketRef.current === socket) socketRef.current = null;
        if (cancelled) return;
        retryTimer = setTimeout(connect, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 1.5, 10000);
      };
      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "identify", guildId }));
    }
  }, [guildId]);

  return { snapshot, connected, chatMessages };
}
