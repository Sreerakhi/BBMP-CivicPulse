# Multi-stage production Dockerfile for Google Cloud Run
FROM node:22-slim AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build Vite frontend assets into /app/dist
RUN npm run build

# --- Production Runner Stage ---
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
# Cloud Run automatically sets the PORT environment variable (typically 8080)
ENV PORT=8080

COPY package*.json ./
# Install only production dependencies + tsx runtime
RUN npm ci --omit=dev && npm install -g tsx

# Copy built frontend assets and server files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/types ./src/types
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
