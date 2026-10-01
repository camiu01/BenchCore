# blog-api service image: install, build, migrate on boot, serve.
FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY api/package.json ./api/
RUN pnpm install --filter blog-api --frozen-lockfile

COPY api ./api
COPY content ./content
RUN pnpm --filter blog-api build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Migrations run against DATABASE_URL, then the compiled server boots.
CMD ["sh", "-c", "pnpm --filter blog-api db:migrate && node api/dist/index.js"]
