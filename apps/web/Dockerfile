# ---------------- BASE ----------------
FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps

# Install dependencies
RUN pnpm install --frozen-lockfile

# ---------------- BUILD ----------------
FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY --from=base /app /app

WORKDIR /app/apps/web

# Build arguments
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BRAND_LOGO_URL=/eduloft/eduloft-logo.png
ARG NEXT_PUBLIC_AUTH_HERO_IMAGE_URL=/eduloft/eduloft-featured.webp

# Environment variables available during build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_BRAND_LOGO_URL=${NEXT_PUBLIC_BRAND_LOGO_URL}
ENV NEXT_PUBLIC_AUTH_HERO_IMAGE_URL=${NEXT_PUBLIC_AUTH_HERO_IMAGE_URL}
ENV NEXT_STANDALONE=true

# Build the application
RUN pnpm build

# ---------------- PRODUCTION ----------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S nodejs && \
    adduser -S nextjs -G nodejs

# Copy standalone build
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy public folder
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

# Documentation only. Render ignores this and injects PORT automatically.
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
