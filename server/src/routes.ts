import { Router } from "express";
import type { GameEngine } from "./gameEngine.js";

export function buildRouter(engine: GameEngine): Router {
  const router = Router();

  router.get("/state", (_req, res) => {
    res.json(engine.getSnapshot());
  });

  router.post("/guilds", (req, res) => {
    const { name, username } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Guild name is required" });
    if (typeof username !== "string" || !username.trim()) return res.status(400).json({ error: "Username is required" });
    const { guild, secret } = engine.createGuild(name, username);
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

  return router;
}
