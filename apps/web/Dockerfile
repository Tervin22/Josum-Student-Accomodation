FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable

# Copy full workspace FIRST (IMPORTANT)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps

# Install ALL dependencies (workspace-safe)
RUN pnpm install --frozen-lockfile

# ---------------- BUILD STAGE ----------------
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY --from=base /app /app

WORKDIR /app/apps/web

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BRAND_LOGO_URL=/logo.svg
ARG NEXT_PUBLIC_AUTH_HERO_IMAGE_URL=https://romares.co.za/wp-content/uploads/2026/09/exterior-1.jpg
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BRAND_LOGO_URL=$NEXT_PUBLIC_BRAND_LOGO_URL
ENV NEXT_PUBLIC_AUTH_HERO_IMAGE_URL=$NEXT_PUBLIC_AUTH_HERO_IMAGE_URL
ENV NEXT_STANDALONE=true

RUN pnpm build

# ---------------- RUNNER ----------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
