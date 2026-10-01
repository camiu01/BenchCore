# blog-frontend image: SvelteKit build (adapter-node) plus node runtime.
# PUBLIC_* env vars are read at request time (process.env), so no build ARGs needed.
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
RUN pnpm install --filter blog-frontend --frozen-lockfile

COPY frontend ./frontend
RUN pnpm --filter blog-frontend build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/frontend/build ./build
COPY --from=build /app/frontend/package.json ./package.json

EXPOSE 3000

CMD ["node", "build"]
