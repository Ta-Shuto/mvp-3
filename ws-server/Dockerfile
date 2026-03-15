# ============================================
# WebSocket Server - Docker Build
# ============================================

FROM node:20-alpine
WORKDIR /app

# Copy root package files for shared dependencies
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Generate Prisma client
COPY prisma ./prisma
COPY src/generated ./src/generated
RUN npx prisma generate

# Copy WebSocket server files
COPY ws-server ./ws-server

EXPOSE 3001

ENV NODE_ENV=production
ENV WS_SERVER_PORT=3001

CMD ["npx", "tsx", "ws-server/index.ts"]
