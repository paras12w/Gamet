import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { CONFIG } from "./config.js";
import { GameEngine } from "./gameEngine.js";
import { buildRouter } from "./routes.js";
import { broadcastChat, broadcastState } from "./ws.js";
import { priceEngine } from "./priceEngine.js";
import { rateLimit } from "./rateLimit.js";

const app = express();
app.set("trust proxy", true); // behind Railway's proxy in production - req.ip should reflect the real client
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

const engine = new GameEngine();
app.use("/api", rateLimit(CONFIG.RATE_LIMIT_WINDOW_MS, CONFIG.RATE_LIMIT_MAX), buildRouter(engine));

// Serve the built client (present in the Docker image / after `npm run build`)
// so a single process can host both the API and the static frontend on one
// Railway service. In local dev this directory doesn't exist - Vite's dev
// server handles the frontend instead, proxying /api and /ws to here.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");
const clientIndex = path.join(clientDist, "index.html");
if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(clientIndex);
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Which guild each open connection identified as - drives snapshot
// redaction (see ws.ts) so a rival's in-progress call isn't visible unless
// it's your own guild or you've scouted them this round.
const guildIdByClient = new Map<WebSocket, string | null>();
const broadcast = () => broadcastState(wss, engine, guildIdByClient);

engine.onUpdate = broadcast;
engine.onChatMessage = (message) => broadcastChat(wss, message);
priceEngine.onTick = broadcast;

wss.on("connection", (socket) => {
  guildIdByClient.set(socket, null);
  socket.send(JSON.stringify({ type: "state", snapshot: engine.getSnapshot(null) }));

  socket.on("message", (raw) => {
    let msg: unknown;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (
      typeof msg === "object" &&
      msg !== null &&
      "type" in msg &&
      (msg as { type: unknown }).type === "identify" &&
      "guildId" in msg &&
      (typeof (msg as { guildId: unknown }).guildId === "string" || (msg as { guildId: unknown }).guildId === null)
    ) {
      const guildId = (msg as { guildId: string | null }).guildId;
      guildIdByClient.set(socket, guildId);
      socket.send(JSON.stringify({ type: "state", snapshot: engine.getSnapshot(guildId) }));
    }
  });

  socket.on("close", () => guildIdByClient.delete(socket));
});

priceEngine.start();

server.listen(CONFIG.PORT, () => {
  console.log(`[gamet] server listening on :${CONFIG.PORT}`);
});

process.on("SIGTERM", () => {
  priceEngine.stop();
  server.close(() => process.exit(0));
});
