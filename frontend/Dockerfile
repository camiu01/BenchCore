# BenchCore frontend image: SvelteKit build (adapter-node) plus node runtime.
# PUBLIC_* env vars are read at request time (process.env), so no build ARGs needed.
FROM node:24-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
RUN pnpm install --filter benchcore-frontend --frozen-lockfile

COPY frontend ./frontend
RUN pnpm --filter benchcore-frontend build
RUN pnpm --filter benchcore-frontend deploy --legacy --prod /deploy

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV BODY_SIZE_LIMIT=8M

WORKDIR /app

COPY --from=build /app/frontend/build ./build
COPY --from=build /app/frontend/package.json ./package.json
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /app/frontend/server.mjs /app/frontend/runtime.mjs ./

EXPOSE 5180

CMD ["node", "server.mjs"]
