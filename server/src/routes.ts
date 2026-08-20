import { Router } from "express";
import { CONFIG, FLAG_COLORS, FLAG_DECALS, GLOBAL_CHAT_ID } from "./config.js";
import { cellKey } from "./grid.js";
import { rateLimit } from "./rateLimit.js";
import type { GameEngine } from "./gameEngine.js";

export function buildRouter(engine: GameEngine): Router {
  const router = Router();
  const createGuildLimit = rateLimit(CONFIG.CREATE_GUILD_RATE_WINDOW_MS, CONFIG.CREATE_GUILD_RATE_MAX);
  const chatLimit = rateLimit(CONFIG.CHAT_RATE_WINDOW_MS, CONFIG.CHAT_RATE_MAX);

  router.get("/state", (_req, res) => {
    res.json(engine.getSnapshot());
  });

  router.get("/flags", (_req, res) => {
    res.json({ colors: FLAG_COLORS, decals: FLAG_DECALS });
  });

  router.post("/guilds", createGuildLimit, (req, res) => {
    const { name, username, flagColor, flagDecal } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Guild name is required" });
    if (typeof username !== "string" || !username.trim()) return res.status(400).json({ error: "Username is required" });
    const { guild, secret } = engine.createGuild(
      name,
      username,
      typeof flagColor === "string" ? flagColor : undefined,
      typeof flagDecal === "string" ? flagDecal : undefined
    );
    res.status(201).json({ guildId: guild.id, leaderSecret: secret });
  });

  router.post("/guilds/:id/join", (req, res) => {
    const { username } = req.body ?? {};
    if (typeof username !== "string" || !username.trim()) return res.status(400).json({ error: "Username is required" });
    const guild = engine.joinGuild(req.params.id, username);
    if (!guild) return res.status(404).json({ error: "Guild not found" });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/propose", async (req, res) => {
    const { leaderSecret, ticker } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof ticker !== "string" || !ticker.trim()) {
      return res.status(400).json({ error: "leaderSecret and ticker are required" });
    }
    const result = await engine.proposeTicker(req.params.id, leaderSecret, ticker);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/place-tile", (req, res) => {
    const { leaderSecret, x, y } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof x !== "number" || typeof y !== "number") {
      return res.status(400).json({ error: "leaderSecret, x, and y are required" });
    }
    const result = engine.placeTile(req.params.id, leaderSecret, cellKey(x, y));
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.get("/guilds/:id/chat", (req, res) => {
    res.json({ messages: engine.getChatHistory(req.params.id) });
  });

  router.post("/guilds/:id/chat", chatLimit, (req, res) => {
    const { username, text } = req.body ?? {};
    if (typeof username !== "string" || !username.trim()) return res.status(400).json({ error: "Username is required" });
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Message text is required" });
    const message = engine.postChatMessage(req.params.id, username, text);
    if (!message) return res.status(404).json({ error: "Guild not found" });
    res.status(201).json({ message });
  });

  router.post("/guilds/:id/propose-alliance", (req, res) => {
    const { leaderSecret, targetGuildId } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof targetGuildId !== "string") {
      return res.status(400).json({ error: "leaderSecret and targetGuildId are required" });
    }
    const result = engine.proposeAlliance(req.params.id, leaderSecret, targetGuildId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/respond-alliance", (req, res) => {
    const { leaderSecret, proposerGuildId, accept } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof proposerGuildId !== "string" || typeof accept !== "boolean") {
      return res.status(400).json({ error: "leaderSecret, proposerGuildId, and accept are required" });
    }
    const result = engine.respondAlliance(req.params.id, leaderSecret, proposerGuildId, accept);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/break-alliance", (req, res) => {
    const { leaderSecret, allyGuildId } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof allyGuildId !== "string") {
      return res.status(400).json({ error: "leaderSecret and allyGuildId are required" });
    }
    const result = engine.breakAlliance(req.params.id, leaderSecret, allyGuildId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.get("/guilds/:id/alliance-chat/:allyId", (req, res) => {
    const messages = engine.getAllianceChatHistory(req.params.id, req.params.allyId);
    if (messages === null) return res.status(400).json({ error: "Not allied with that guild" });
    res.json({ messages });
  });

  router.post("/guilds/:id/alliance-chat/:allyId", chatLimit, (req, res) => {
    const { username, text } = req.body ?? {};
    if (typeof username !== "string" || !username.trim()) return res.status(400).json({ error: "Username is required" });
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Message text is required" });
    const message = engine.postAllianceMessage(req.params.id, req.params.allyId, username, text);
    if (!message) return res.status(400).json({ error: "Not allied with that guild" });
    res.status(201).json({ message });
  });

  router.post("/guilds/:id/propose-wager", (req, res) => {
    const { leaderSecret, targetGuildId, amount } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof targetGuildId !== "string" || typeof amount !== "number") {
      return res.status(400).json({ error: "leaderSecret, targetGuildId, and amount are required" });
    }
    const result = engine.proposeWager(req.params.id, leaderSecret, targetGuildId, amount);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/respond-wager", (req, res) => {
    const { leaderSecret, wagerId, accept } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof wagerId !== "string" || typeof accept !== "boolean") {
      return res.status(400).json({ error: "leaderSecret, wagerId, and accept are required" });
    }
    const result = engine.respondWager(req.params.id, leaderSecret, wagerId, accept);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/cancel-wager", (req, res) => {
    const { leaderSecret, wagerId } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof wagerId !== "string") {
      return res.status(400).json({ error: "leaderSecret and wagerId are required" });
    }
    const result = engine.cancelWager(req.params.id, leaderSecret, wagerId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/scout", (req, res) => {
    const { leaderSecret, targetGuildId } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof targetGuildId !== "string") {
      return res.status(400).json({ error: "leaderSecret and targetGuildId are required" });
    }
    const result = engine.scoutGuild(req.params.id, leaderSecret, targetGuildId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/claim-leadership", (req, res) => {
    const { username } = req.body ?? {};
    if (typeof username !== "string" || !username.trim()) return res.status(400).json({ error: "Username is required" });
    const result = engine.claimLeadership(req.params.id, username);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true, leaderSecret: result.leaderSecret });
  });

  router.post("/guilds/:id/set-tagline", (req, res) => {
    const { leaderSecret, tagline } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof tagline !== "string") {
      return res.status(400).json({ error: "leaderSecret and tagline are required" });
    }
    const result = engine.setTagline(req.params.id, leaderSecret, tagline);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  // ---------- the Market ----------

  router.post("/guilds/:id/market/buy-tile", (req, res) => {
    const { leaderSecret } = req.body ?? {};
    if (typeof leaderSecret !== "string") return res.status(400).json({ error: "leaderSecret is required" });
    const result = engine.buyTile(req.params.id, leaderSecret);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/market/buy-bridge-permit", (req, res) => {
    const { leaderSecret } = req.body ?? {};
    if (typeof leaderSecret !== "string") return res.status(400).json({ error: "leaderSecret is required" });
    const result = engine.buyBridgePermit(req.params.id, leaderSecret);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/market/buy-ward", (req, res) => {
    const { leaderSecret } = req.body ?? {};
    if (typeof leaderSecret !== "string") return res.status(400).json({ error: "leaderSecret is required" });
    const result = engine.buyWard(req.params.id, leaderSecret);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/market/buy-spyglass", (req, res) => {
    const { leaderSecret } = req.body ?? {};
    if (typeof leaderSecret !== "string") return res.status(400).json({ error: "leaderSecret is required" });
    const result = engine.buySpyglass(req.params.id, leaderSecret);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/market/buy-herald-favor", (req, res) => {
    const { leaderSecret } = req.body ?? {};
    if (typeof leaderSecret !== "string") return res.status(400).json({ error: "leaderSecret is required" });
    const result = engine.buyHeraldFavor(req.params.id, leaderSecret);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.post("/guilds/:id/market/buy-title", (req, res) => {
    const { leaderSecret, title } = req.body ?? {};
    if (typeof leaderSecret !== "string" || typeof title !== "string") {
      return res.status(400).json({ error: "leaderSecret and title are required" });
    }
    const result = engine.buyTitle(req.params.id, leaderSecret, title);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  router.get("/chat/global", (_req, res) => {
    res.json({ messages: engine.getChatHistory(GLOBAL_CHAT_ID) });
  });

  router.post("/chat/global", chatLimit, (req, res) => {
    const { username, text } = req.body ?? {};
    if (typeof username !== "string" || !username.trim()) return res.status(400).json({ error: "Username is required" });
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Message text is required" });
    const message = engine.postChatMessage(GLOBAL_CHAT_ID, username, text);
    if (!message) return res.status(400).json({ error: "Message could not be sent" });
    res.status(201).json({ message });
  });

  return router;
}
