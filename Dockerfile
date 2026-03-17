# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Stage 2: Build the application
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars must be present at build time (baked into client bundle)
ARG NEXT_PUBLIC_BASE_URL=https://dataroom.syntaxia.com
ARG NEXT_PUBLIC_MARKETING_URL=https://dataroom.syntaxia.com
ARG NEXT_PUBLIC_APP_BASE_HOST=dataroom.syntaxia.com
ARG NEXT_PUBLIC_UPLOAD_TRANSPORT=s3
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL
ENV NEXT_PUBLIC_APP_BASE_HOST=$NEXT_PUBLIC_APP_BASE_HOST
ENV NEXT_PUBLIC_UPLOAD_TRANSPORT=$NEXT_PUBLIC_UPLOAD_TRANSPORT

# Dummy build-time values for modules that throw at import during page data collection.
# These are NEVER used at runtime — real values are injected via Kamal env at container start.
ENV OPENAI_API_KEY=build-placeholder \
    POSTGRES_PRISMA_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    POSTGRES_PRISMA_URL_NON_POOLING=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    UPSTASH_REDIS_REST_URL=https://placeholder.upstash.io \
    UPSTASH_REDIS_REST_TOKEN=build-placeholder \
    UPSTASH_REDIS_REST_LOCKER_URL=https://placeholder.upstash.io \
    UPSTASH_REDIS_REST_LOCKER_TOKEN=build-placeholder \
    NEXTAUTH_SECRET=build-placeholder \
    NEXTAUTH_URL=https://placeholder.local \
    INTERNAL_API_KEY=build-placeholder \
    STRIPE_SECRET_KEY=sk_test_placeholder \
    TINYBIRD_TOKEN=build-placeholder \
    NEXT_PRIVATE_UPLOAD_BUCKET=build-placeholder \
    NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID=build-placeholder \
    NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY=build-placeholder

RUN npm run build

# Stage 3: Production runner
FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma for runtime migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
