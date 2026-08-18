# Multi-stage build: compile the server + client, then run on a slim image
# without leftover build tools. Debian-based (not alpine) throughout so the
# better-sqlite3 native addon compiled in `deps` runs unmodified in `runner`.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 builds from source unless a prebuilt binary matches this
# exact image; these let it compile if it has to.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/app/data/gamet.sqlite

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 4000
CMD ["node", "server/dist/index.js"]
