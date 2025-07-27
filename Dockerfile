# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /build
COPY backend/package*.json ./
RUN npm install --omit=dev

# Final image
FROM node:20-alpine
RUN apk add --no-cache sqlite curl tzdata
WORKDIR /app

# Copy backend
COPY --from=backend-builder /build/node_modules ./node_modules
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-builder /build/dist ./public

# Create non-root user (use different UID/GID if 1000 is taken)
RUN addgroup -S novelarr && \
    adduser -S novelarr -G novelarr && \
    mkdir -p /config && \
    chown -R novelarr:novelarr /app /config

USER novelarr
EXPOSE 8096
VOLUME /config

ENV NODE_ENV=production
ENV DB_PATH=/config/novelarr.db
ENV PORT=8096

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -f http://localhost:8096/api/health || exit 1

CMD ["node", "server.js"]