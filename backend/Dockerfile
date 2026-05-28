FROM node:22-alpine AS deps

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/prisma ./prisma
RUN npx prisma generate

FROM node:22-alpine AS runner

WORKDIR /app/backend

COPY --chown=node:node --from=deps /app/backend/node_modules ./node_modules
COPY --chown=node:node --from=deps /app/backend/prisma ./prisma
COPY --chown=node:node backend/src ./src
USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
