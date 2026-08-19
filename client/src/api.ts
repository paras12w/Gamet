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

export function getAllianceChatHistory(guildId: string, allyId: string) {
  return request<{ messages: ChatMessage[] }>(`/guilds/${guildId}/alliance-chat/${allyId}`);
}

export function sendAllianceChatMessage(guildId: string, allyId: string, username: string, text: string) {
  return request<{ message: ChatMessage }>(`/guilds/${guildId}/alliance-chat/${allyId}`, {
    method: "POST",
    body: JSON.stringify({ username, text }),
  });
}

export function proposeWager(guildId: string, leaderSecret: string, targetGuildId: string, amount: number) {
  return request<{ ok: true }>(`/guilds/${guildId}/propose-wager`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, targetGuildId, amount }),
  });
}

export function respondWager(guildId: string, leaderSecret: string, wagerId: string, accept: boolean) {
  return request<{ ok: true }>(`/guilds/${guildId}/respond-wager`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, wagerId, accept }),
  });
}

export function cancelWager(guildId: string, leaderSecret: string, wagerId: string) {
  return request<{ ok: true }>(`/guilds/${guildId}/cancel-wager`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, wagerId }),
  });
}

export function scoutGuild(guildId: string, leaderSecret: string, targetGuildId: string) {
  return request<{ ok: true }>(`/guilds/${guildId}/scout`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, targetGuildId }),
  });
}

export function claimLeadership(guildId: string, username: string) {
  return request<{ ok: true; leaderSecret: string }>(`/guilds/${guildId}/claim-leadership`, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function setTagline(guildId: string, leaderSecret: string, tagline: string) {
  return request<{ ok: true }>(`/guilds/${guildId}/set-tagline`, {
    method: "POST",
    body: JSON.stringify({ leaderSecret, tagline }),
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
