import { useState } from "react";
import type { Identity } from "../types";

export function UsernameScreen({ identity, setIdentity }: { identity: Identity; setIdentity: (i: Identity) => void }) {
  const [username, setUsername] = useState(identity.username);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setIdentity({ ...identity, username: username.trim() });
  }

  return (
    <div className="parchment-screen">
      <div className="parchment-screen__brand">
        <h1>GAMET</h1>
        <p>An empire built on the price of gold, not the roll of dice.</p>
      </div>
      <form className="parchment-card" onSubmit={submit}>
        <h2>Enter the Realm</h2>
        <label htmlFor="username">Your name, traveler</label>
        <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Wolfric the Bold" maxLength={30} autoFocus />
        <button type="submit" disabled={!username.trim()}>
          Continue
        </button>
      </form>
    </div>
  );
}
