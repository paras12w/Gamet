async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function createGuild(name: string, username: string) {
  return request<{ guildId: string; leaderSecret: string }>("/guilds", {
    method: "POST",
    body: JSON.stringify({ name, username }),
  });
}

export function joinGuild(guildId: string, username: string) {
  return request<{ ok: true }>(`/guilds/${guildId}/join`, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function proposeTicker(guildId: string, leaderSecret: string, ticker: string) {
  return request<{ ok: true }>(`/guilds/${guildId}/propose`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, ticker }),
  });
}
