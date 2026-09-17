# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

# ---------- dependencies ----------
FROM base AS dependencies
COPY package*.json ./
RUN npm ci

# ---------- build ----------
FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build

# ---------- production ----------
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
# Sem migrate/seed no CMD: migrations rodam no CI (.github/workflows/production.yml)
USER node
CMD ["node", "dist/main.js"]

# ---------- development ----------
FROM base AS development
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY docker-entrypoint.dev.sh ./
EXPOSE 3000
CMD ["sh", "docker-entrypoint.dev.sh"]
