# GAMET — Stock Empire

A real-time, browser-based empire-building game where guilds expand across a
grid by calling stock tickers. Every round, each guild leader bets on a
ticker; if it's up when the round ends, their guild expands onto the map. If
two guilds end up sharing a border, the next round becomes a head-to-head
battle for that square instead.

## Quick start

```bash
npm install
npm run dev
```

This starts the API/WebSocket server on `:4000` and the Vite dev server on
`:5173` (proxying `/api` and `/ws` to the backend). Open
`http://localhost:5173`.

For a faster local test loop (default rounds are 3 minutes), run the server
with shorter rounds:

```bash
cd server
ROUND_DURATION_MS=15000 SESSION_ROUNDS=6 npm run dev
```

Optionally copy `server/.env.example` to `server/.env` to configure a
[Finnhub](https://finnhub.io) API key for higher-quality live quotes — the
game works without one, falling back to Yahoo Finance's public chart
endpoint and then a curated list of well-known tickers if that's also
unreachable.

## How it plays

New players pick a name, read a one-time rules page, then choose to play
solo (a lone one-person warband), join an existing guild, or found a new
guild and design its banner (a color plus an emblem, picked from a curated
set - validated server-side so a client can't send an arbitrary flag).

- **Guilds & HQs.** Anyone can found a guild (they become its leader) or
  join an existing one. New guilds are dropped onto a random, unclaimed spot
  on the grid as their headquarters.
- **Rounds (default 3 min).** Once per round, a guild's leader can call a
  ticker they think will rise. The price at the moment they call it is the
  baseline; the price when the round ends decides the outcome.
  - Call goes **up** → the guild expands onto a random empty square
    touching their territory.
  - Call goes **down or flat** → no expansion this round.
  - No call → the guild sits out.
- **Border battles.** If two guilds' territories end up adjacent, the
  *next* round is a battle instead of normal expansion for both of them.
  Whoever's call performed better (even if both are negative — the less
  negative side wins) captures the contested square and gets to place one
  extra square. The loser's contested square is gone. A tie changes
  nothing. Not calling a ticker during a battle round is an automatic
  forfeit.
- **Takeovers.** Beat the *same* guild in two battles in a row and you
  absorb them entirely — every square they hold transfers to you and their
  members join your ranks.
- **Neutral castles.** Four fixed, neutral squares sit on the map. Whoever
  captures one gets a free bonus square every 2 rounds for as long as they
  hold it, on top of whatever their stock calls earn them.
- **Sessions (default 2 hours / 40 rounds).** At the end of a session, the
  guild with the most squares earns 3 permanent tokens. The map then
  resets — everyone's squares clear and HQs are re-rolled — but guild
  identities, membership, and tokens carry over into the next session.

## Prices: live when the market's open, simulated when it's not

A 3-minute round loop needs prices around the clock, but the real market is
only open ~6.5 hours a day on weekdays. So:

- While NYSE hours are active (9:30am–4:00pm ET, Mon–Fri, holidays not
  accounted for), the server polls live quotes and ticker prices track the
  real market.
- Outside those hours (or if a live fetch fails), prices continue moving
  via a small server-side random walk seeded from the last known real
  price, so the game — and stock movement — never stops.
- A ticker has to resolve to a real symbol (live quote or a curated
  known-ticker fallback) to be callable; nonsense tickers are rejected.

## Deploying (Railway)

The server and client build into a single deployable process — the Express
server serves the built client as static files and answers `/api` + `/ws`
on the same port, so one Railway service is enough.

1. Push this repo to GitHub (or connect the repo directly) and create a new
   Railway project from it. Railway auto-detects the root `Dockerfile` and
   `railway.toml`.
2. Optionally set `FINNHUB_API_KEY` as a Railway variable for higher-quality
   live quotes (see `server/.env.example` for every other tunable). `PORT`
   is injected by Railway automatically - don't set it yourself.
3. By default the SQLite file (guild identities/tokens/session history)
   lives on the container's local disk, which is wiped on every redeploy.
   To keep that data across deploys, attach a Railway volume mounted at
   `/app/data` (the image already points `DB_PATH` there).
4. Deploy. Railway builds the Docker image (`npm run build` for both
   workspaces, multi-stage so the final image doesn't carry build tools)
   and runs `node server/dist/index.js`.

You can also build/run the image locally to sanity-check it: `docker build
-t gamet . && docker run -p 4000:4000 gamet`.

## Architecture

```
server/   Node + TypeScript + Express + ws, in-memory game engine,
          SQLite (better-sqlite3) for guild identity/tokens/session history.
client/   React + TypeScript + Vite, WebSocket-driven UI.
```

- `server/src/gameEngine.ts` — the whole game loop: grid, expansion,
  battles, takeovers, castle buffs, session resets.
- `server/src/priceEngine.ts` — the live/simulated hybrid price feed.
- `server/src/routes.ts` + `ws.ts` — REST for actions (create/join guild,
  propose a ticker), WebSocket for pushing full state on every change.
- `client/src/App.tsx` — ties together the join/lobby flow and the main
  game view once you're in a guild.

### Known limitations (MVP scope)

- Identity is a plain username stored client-side with no password — good
  enough for a quick-join prototype, not for public deployment as-is.
- Live grid/round state lives in memory and is **not** persisted across a
  server restart (guild names, membership, and tokens are, via SQLite).
- US market holidays aren't accounted for when deciding "is the market
  open" — a holiday just falls back to simulated pricing like a weekend
  would if a live quote fails to update.
