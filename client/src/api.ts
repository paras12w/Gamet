import type { ChatMessage, FlagOptions } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function createGuild(name: string, username: string, flagColor?: string, flagDecal?: string) {
  return request<{ guildId: string; leaderSecret: string }>("/guilds", {
    method: "POST",
    body: JSON.stringify({ name, username, flagColor, flagDecal }),
  });
}

export function getFlagOptions() {
  return request<FlagOptions>("/flags");
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

export function placeTile(guildId: string, leaderSecret: string, x: number, y: number) {
  return request<{ ok: true }>(`/guilds/${guildId}/place-tile`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, x, y }),
  });
}

export function getChatHistory(guildId: string) {
  return request<{ messages: ChatMessage[] }>(`/guilds/${guildId}/chat`);
}

export function sendChatMessage(guildId: string, username: string, text: string) {
  return request<{ message: ChatMessage }>(`/guilds/${guildId}/chat`, {
    method: "POST",
    body: JSON.stringify({ username, text }),
  });
}

export function proposeAlliance(guildId: string, leaderSecret: string, targetGuildId: string) {
  return request<{ ok: true }>(`/guilds/${guildId}/propose-alliance`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, targetGuildId }),
  });
}

export function respondAlliance(guildId: string, leaderSecret: string, proposerGuildId: string, accept: boolean) {
  return request<{ ok: true }>(`/guilds/${guildId}/respond-alliance`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, proposerGuildId, accept }),
  });
}

export function breakAlliance(guildId: string, leaderSecret: string, allyGuildId: string) {
  return request<{ ok: true }>(`/guilds/${guildId}/break-alliance`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, allyGuildId }),
  });
}

export function getGlobalChatHistory() {
  return request<{ messages: ChatMessage[] }>(`/chat/global`);
}

export function sendGlobalChatMessage(username: string, text: string) {
  return request<{ message: ChatMessage }>(`/chat/global`, {
    method: "POST",
    body: JSON.stringify({ username, text }),
  });
}
