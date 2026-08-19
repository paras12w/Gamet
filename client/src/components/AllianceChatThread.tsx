import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { getAllianceChatHistory, sendAllianceChatMessage } from "../api";
import { soundEngine } from "../lib/sound";

export function AllianceChatThread({
  guildId,
  allyId,
  username,
  chatMessages,
}: {
  guildId: string;
  allyId: string;
  username: string;
  chatMessages: ChatMessage[];
}) {
  const channelKey = `alliance:${[guildId, allyId].sort().join("|")}`;
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAllianceChatHistory(guildId, allyId)
      .then((r) => setHistory(r.messages))
      .catch(() => {
        /* chat history is a nice-to-have, fail quietly */
      });
  }, [guildId, allyId]);

  const combined = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    for (const m of history) byId.set(m.id, m);
    for (const m of chatMessages) if (m.guildId === channelKey) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.at - b.at);
  }, [history, chatMessages, channelKey]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [combined.length]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendAllianceChatMessage(guildId, allyId, username, draft);
      setDraft("");
      soundEngine.play("click");
    } catch {
      /* best-effort chat, drop silently */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="alliance-chat">
      <div className="alliance-chat__log" ref={logRef}>
        {combined.length === 0 && <div className="empty-hint">No messages yet — say hello to your ally.</div>}
        {combined.map((m) => (
          <div key={m.id} className="chat-message">
            <span className="chat-message__author">{m.username}:</span> <span className="chat-message__text">{m.text}</span>
          </div>
        ))}
      </div>
      <form className="guild-menu__chat-form" onSubmit={sendMessage}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message this ally…" maxLength={300} />
        <button type="submit" disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
