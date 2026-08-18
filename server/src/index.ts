import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { CONFIG } from "./config.js";
import { GameEngine } from "./gameEngine.js";
import { buildRouter } from "./routes.js";
import { broadcastState } from "./ws.js";
import { priceEngine } from "./priceEngine.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

const engine = new GameEngine();
app.use("/api", buildRouter(engine));

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

engine.onUpdate = () => broadcastState(wss, engine.getSnapshot());

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "state", snapshot: engine.getSnapshot() }));
});

priceEngine.start();

server.listen(CONFIG.PORT, () => {
  console.log(`[gamet] server listening on :${CONFIG.PORT}`);
});

process.on("SIGTERM", () => {
  priceEngine.stop();
  server.close(() => process.exit(0));
});
