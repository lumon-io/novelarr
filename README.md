# Novelarr - Book Request Management for Readarr

A minimal, Docker-first book request management system for Readarr.

## Quick Start

```bash
# Build and run
docker-compose up --build

# Access at http://localhost:8096
# Default login: admin / admin
```

## Features

- User authentication
- Book search (min 2 characters)
- Request books to Readarr
- View request history
- SQLite database with persistence
- Single container deployment

## Configuration

Edit `docker-compose.yml` to set:
- `READARR_URL`: Your Readarr instance URL
- `READARR_API_KEY`: Your Readarr API key
- `JWT_SECRET`: Change in production!

## Testing

```bash
# Health check
curl http://localhost:8096/api/health

# Test persistence
docker-compose down
docker-compose up  # Data persists

# View logs
docker logs novelarr
```

## Building for Production

```bash
docker build -t novelarr:latest .
docker run -d \
  -p 8096:8096 \
  -v /path/to/config:/config \
  -e READARR_URL=http://your-readarr:8787 \
  -e READARR_API_KEY=your-key \
  -e JWT_SECRET=secure-secret \
  novelarr:latest
```