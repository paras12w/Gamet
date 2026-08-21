import { useEffect } from "react";
import type { ChatMessage } from "../types";
import { GlobalChat } from "./GlobalChat";

export function RealmChatModal({
  chatMessages,
  username,
  onClose,
}: {
  chatMessages: ChatMessage[];
  username: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="guild-menu-overlay" onClick={onClose}>
      <div className="guild-menu guild-menu--simple guild-menu--chat" onClick={(e) => e.stopPropagation()}>
        <div className="guild-menu__header">
          <div className="guild-menu__title">
            <h2>Realm Chat</h2>
            <p>Open to every guild and spectator in the realm</p>
          </div>
          <button type="button" className="guild-menu__close" onClick={onClose} aria-label="Close realm chat">
            ×
          </button>
        </div>
        <div className="guild-menu__body">
          <GlobalChat chatMessages={chatMessages} username={username} />
        </div>
      </div>
    </div>
  );
}
