FROM node:22-slim

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY render-worker/package.json render-worker/tsconfig.json ./render-worker/
RUN corepack enable && pnpm install --frozen-lockfile

COPY src ./src
COPY render-worker/src ./render-worker/src
COPY templates ./templates

ENV NODE_ENV=production
EXPOSE 4100
CMD ["pnpm", "--filter", "render-worker", "start"]
