import { useEffect, useRef, useState } from "react";
import type { ChatMessage, GameStateSnapshot } from "../types";

const CHAT_BUFFER_LIMIT = 300;

export function useGameSocket() {
  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const retryDelay = useRef(1000);

  useEffect(() => {
    let socket: WebSocket;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws`);

      socket.onopen = () => {
        retryDelay.current = 1000;
        setConnected(true);
      };
      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "state") setSnapshot(msg.snapshot);
        else if (msg.type === "chat") setChatMessages((prev) => [...prev, msg.message].slice(-CHAT_BUFFER_LIMIT));
      };
      socket.onclose = () => {
        setConnected(false);
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

  return { snapshot, connected, chatMessages };
}
