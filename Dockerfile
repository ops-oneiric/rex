# syntax=docker/dockerfile:1

# The full image has python3, make and g++, which npm needs if it compiles a native module
# (better-sqlite3) from source. Only the final stage below ships, and it uses the slim image.
FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_PATH=/app/data/rex.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/next", "start"]
