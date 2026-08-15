FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS deps

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/prisma ./prisma
RUN npx prisma generate

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runner

# Кириллица в PDF (заявки, консультации, сервисная книжка)
RUN apk add --no-cache ttf-dejavu

WORKDIR /app/backend

COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=deps /app/backend/prisma ./prisma
COPY backend/package.json ./package.json
COPY backend/src ./src

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
