FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:18-alpine AS builder
WORKDIR /app
ENV NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_MOCK_MODE=false 
ARG NEXT_PUBLIC_ENTRA_CLIENT_ID
ARG NEXT_PUBLIC_ENTRA_TENANT_ID
ENV NEXT_PUBLIC_ENTRA_CLIENT_ID=$NEXT_PUBLIC_ENTRA_CLIENT_ID
ENV NEXT_PUBLIC_ENTRA_TENANT_ID=$NEXT_PUBLIC_ENTRA_TENANT_ID
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