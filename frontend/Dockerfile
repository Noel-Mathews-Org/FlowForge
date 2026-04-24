# Stage 1: Dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app
ARG BASE_PUBLIC_URL
# Pass build-time variables for Next.js client-side injection
ENV NEXT_PUBLIC_AUTH_URL=http://${BASE_PUBLIC_URL}:8000/api/auth
ENV NEXT_PUBLIC_PROJECT_URL=http://${BASE_PUBLIC_URL}:8000/api/projects
ENV NEXT_PUBLIC_TASK_URL=http://${BASE_PUBLIC_URL}:8000/api/tasks
ENV NEXT_PUBLIC_ANALYTICS_URL=http://${BASE_PUBLIC_URL}:8000/api/analytics
ENV NEXT_PUBLIC_MOCK_MODE=false

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner (Production)
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 stgroup \
    && adduser --system --uid 1001 --ingroup stgroup stuser

# Standalone mode only needs these specific files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=stuser:stgroup /app/.next/standalone ./
COPY --from=builder --chown=stuser:stgroup /app/.next/static ./.next/static

USER stuser
EXPOSE 3000

# Standalone output creates its own server.js, no npm start required
CMD ["node", "server.js"]