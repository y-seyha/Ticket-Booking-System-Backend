
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY prisma ./prisma

RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build

# Production image ──
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY prisma ./prisma

RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/main"]
