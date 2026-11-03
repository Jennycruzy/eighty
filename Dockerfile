FROM node:22.23.4-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@10.29.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile
COPY . .
ENV NITRO_PRESET=node
RUN pnpm build

FROM node:22.23.4-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV AGENT_NATIVE_PRIVATE_BLOB_PUBLIC_UPLOAD_FALLBACK=0

COPY --from=build --chown=node:node /app/.output .output
RUN chown node:node /app
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
