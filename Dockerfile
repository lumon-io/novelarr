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

# Install required packages
RUN apk add --no-cache \
    sqlite \
    curl \
    tzdata \
    su-exec \
    shadow

WORKDIR /app

# Copy backend
COPY --from=backend-builder /build/node_modules ./node_modules
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-builder /build/dist ./public

# Create directories with proper permissions
RUN mkdir -p \
    /app/data \
    /media/books \
    /media/audiobooks \
    /media/magazines \
    /media/comics \
    /downloads/books \
    /downloads/audiobooks \
    /downloads/magazines \
    /downloads/comics \
    /calibre

# Add init script for PUID/PGID support
COPY docker-init.sh /docker-init.sh
RUN chmod +x /docker-init.sh

EXPOSE 8096

# Volume declarations
VOLUME ["/app/data", "/media", "/downloads"]

# Environment defaults
ENV NODE_ENV=production \
    DB_PATH=/app/data/novelarr.db \
    PORT=8096 \
    PUID=1000 \
    PGID=1000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -f http://localhost:8096/api/health || exit 1

ENTRYPOINT ["/docker-init.sh"]
CMD ["node", "server.js"]