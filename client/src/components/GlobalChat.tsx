import { useEffect, useMemo, useRef, useState } from "react";
import { GLOBAL_CHAT_ID } from "../types";
import type { ChatMessage } from "../types";
import { getGlobalChatHistory, sendGlobalChatMessage } from "../api";
import { soundEngine } from "../lib/sound";

export function GlobalChat({ chatMessages, username }: { chatMessages: ChatMessage[]; username: string }) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getGlobalChatHistory()
      .then((r) => setHistory(r.messages))
      .catch(() => {
        /* chat history is a nice-to-have, fail quietly */
      });
  }, []);

  const combined = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    for (const m of history) byId.set(m.id, m);
    for (const m of chatMessages) if (m.guildId === GLOBAL_CHAT_ID) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.at - b.at);
  }, [history, chatMessages]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [combined.length]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendGlobalChatMessage(username, draft);
      setDraft("");
      soundEngine.play("click");
    } catch {
      /* best-effort chat, drop silently */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="panel global-chat">
      <div className="panel__header">
        <h2>🌍 Realm Chat</h2>
      </div>
      <div className="global-chat__log" ref={logRef}>
        {combined.length === 0 && <div className="empty-hint">The realm is quiet — say hello.</div>}
        {combined.map((m) => (
          <div key={m.id} className="chat-message">
            <span className="chat-message__author">{m.username}:</span> <span className="chat-message__text">{m.text}</span>
          </div>
        ))}
      </div>
      <form className="guild-menu__chat-form" onSubmit={sendMessage}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message the realm…" maxLength={300} />
        <button type="submit" disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
