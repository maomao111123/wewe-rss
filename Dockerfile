FROM node:20.16.0-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN npm i -g pnpm@8.15.8

FROM base AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm db:generate

COPY . .
RUN pnpm build

FROM base AS app
WORKDIR /app

ENV NODE_ENV=production
ENV HOST="0.0.0.0"
ENV PORT="4000"
ENV SERVER_ORIGIN_URL=""
ENV MAX_REQUEST_PER_MINUTE="60"
ENV FEED_MODE=""
ENV CRON_EXPRESSION="35 5,17 * * *"
ENV UPDATE_DELAY_TIME="60"
ENV ENABLE_CLEAN_HTML="false"
ENV PLATFORM_URL="https://weread.111965.xyz"

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src

EXPOSE 4000

CMD ["node", "scripts/start.mjs"]
