import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import { WebSocketServer } from "ws";
import { CONFIG } from "./config.js";
import { GameEngine } from "./gameEngine.js";
import { buildRouter } from "./routes.js";
import { broadcastState } from "./ws.js";
import { priceEngine } from "./priceEngine.js";

const app = express();
app.use(cors());
app.use(express.json());

const engine = new GameEngine();
app.use("/api", buildRouter(engine));

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
