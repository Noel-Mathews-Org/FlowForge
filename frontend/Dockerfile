FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:18-alpine AS builder
WORKDIR /app
ENV NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_MOCK_MODE=false 
# Hardcoded Entra ID config to bypass reusable workflow injecting AZURE_CLIENT_ID
ENV NEXT_PUBLIC_ENTRA_CLIENT_ID="668b4772-3c2e-4b86-98e0-04c58199cfe5"
ENV NEXT_PUBLIC_ENTRA_TENANT_ID="d8537334-bc24-4daf-95a8-bf4c9fb14394"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 stgroup \
    && adduser --system --uid 1001 --ingroup stgroup stuser
COPY --from=builder /app/public ./public
COPY --from=builder --chown=stuser:stgroup /app/.next/standalone ./
COPY --from=builder --chown=stuser:stgroup /app/.next/static ./.next/static
USER stuser
CMD ["node", "server.js"]