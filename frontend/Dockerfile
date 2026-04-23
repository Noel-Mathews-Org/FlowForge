FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
ARG BASE_PUBLIC_URL
ENV NEXT_PUBLIC_AUTH_URL=http://${BASE_PUBLIC_URL}:8000/api/auth
ENV NEXT_PUBLIC_PROJECT_URL=http://${BASE_PUBLIC_URL}:8000/api/projects
ENV NEXT_PUBLIC_TASK_URL=http://${BASE_PUBLIC_URL}:8000/api/tasks
ENV NEXT_PUBLIC_ANALYTICS_URL=http://${BASE_PUBLIC_URL}:8000/api/analytics
ENV NEXT_PUBLIC_MOCK_MODE=false
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 stgroup \
    && adduser --system --uid 1001 --ingroup stgroup stuser
COPY --from=builder --chown=stuser:stgroup /app/public ./public
COPY --from=builder --chown=stuser:stgroup /app/.next ./.next
COPY --from=builder --chown=stuser:stgroup /app/node_modules ./node_modules
COPY --from=builder --chown=stuser:stgroup /app/package.json ./package.json
COPY --from=builder --chown=stuser:stgroup /app/next.config.js ./next.config.js
USER stuser
EXPOSE 3000
CMD ["npm", "start"]