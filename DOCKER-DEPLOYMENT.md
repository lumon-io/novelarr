# Novelarr Docker Deployment Guide

## Overview

Novelarr is designed as an all-in-one book management system that combines:
- **Request Management** (like Ombi/Overseerr) - Users can search and request content
- **Media Server Integration** (like Plex/Emby) - Direct integration with your media library
- **Download Automation** (via Readarr) - Automated downloading and organization

## Folder Structure

Novelarr uses a standardized folder structure that integrates with your existing media setup:

```
/app/data/              # Novelarr configuration and database
├── novelarr.db         # SQLite database
├── logs/               # Application logs
└── backups/            # Database backups

/media/                 # Organized media library (read-only for Novelarr)
├── books/              # Standard books (epub, mobi, azw3, pdf)
├── audiobooks/         # Audio books (m4b, mp3, etc.)
├── magazines/          # Periodicals and magazines
├── comics/             # Comic books (cbr, cbz)
└── manga/              # Manga collections

/downloads/             # Download client output folders
├── books/              # Where book downloads complete
├── audiobooks/         # Where audiobook downloads complete
├── magazines/          # Where magazine downloads complete
├── comics/             # Where comic downloads complete
└── manga/              # Where manga downloads complete
```

## Docker Compose Configuration

### Basic Setup

```yaml
version: '3.8'

services:
  novelarr:
    image: novelarr:latest
    container_name: novelarr
    environment:
      - PUID=1000              # Your user ID
      - PGID=1000              # Your group ID
      - TZ=America/New_York    # Your timezone
    volumes:
      - ./config:/app/data     # Configuration directory
      - /media:/media:ro       # Media library (read-only)
      - /downloads:/downloads  # Downloads directory
    ports:
      - "8096:8096"
    restart: unless-stopped
```

### Advanced Setup with All Options

```yaml
version: '3.8'

services:
  novelarr:
    image: novelarr:latest
    container_name: novelarr
    hostname: novelarr
    environment:
      # User/Group IDs for file permissions
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
      
      # Optional: Database location override
      - DB_PATH=/app/data/novelarr.db
      
      # Optional: Custom port
      - PORT=8096
      
    volumes:
      # Required: Configuration
      - ./config:/app/data
      
      # Media Libraries (match your Readarr/Plex paths)
      - /mnt/media/books:/media/books:ro
      - /mnt/media/audiobooks:/media/audiobooks:ro
      - /mnt/media/magazines:/media/magazines:ro
      - /mnt/media/comics:/media/comics:ro
      - /mnt/media/manga:/media/manga:ro
      
      # Download Folders (match your download client)
      - /mnt/downloads/complete/books:/downloads/books
      - /mnt/downloads/complete/audiobooks:/downloads/audiobooks
      - /mnt/downloads/complete/magazines:/downloads/magazines
      - /mnt/downloads/complete/comics:/downloads/comics
      - /mnt/downloads/complete/manga:/downloads/manga
      
      # Optional: Calibre library for conversion
      - /mnt/calibre:/calibre:ro
      
    ports:
      - "8096:8096"
      
    restart: unless-stopped
    
    # Optional: Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
          
    # Optional: Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8096/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Integration with Existing Setup

### Path Mapping

Ensure your paths match between Novelarr and your other services:

| Service | Media Path | Download Path |
|---------|------------|---------------|
| Novelarr | `/media/books` | `/downloads/books` |
| Readarr | `/books` | `/downloads/books` |
| Calibre | `/books` | - |
| Plex/Emby | `/media/books` | - |

### Network Configuration

If running with other media containers:

```yaml
networks:
  media-network:
    external: true
    
services:
  novelarr:
    networks:
      - media-network
```

## Content Types

Novelarr supports multiple content types, each with its own folder structure:

### Books (Default)
- **Formats**: epub, mobi, azw3, pdf, txt, doc, docx
- **Integration**: Readarr, Calibre
- **Media Path**: `/media/books`

### Audiobooks
- **Formats**: m4b, mp3, m4a, flac
- **Integration**: Readarr (with Beets), AudioBookshelf
- **Media Path**: `/media/audiobooks`

### Magazines
- **Formats**: pdf, epub
- **Integration**: Custom indexers
- **Media Path**: `/media/magazines`

### Comics
- **Formats**: cbr, cbz, pdf
- **Integration**: Mylar3
- **Media Path**: `/media/comics`

### Manga
- **Formats**: cbz, pdf, epub
- **Integration**: Komga, custom indexers
- **Media Path**: `/media/manga`

## First Run Setup

1. **Start the container**:
   ```bash
   docker-compose up -d
   ```

2. **Access Novelarr**:
   - Navigate to `http://localhost:8096`
   - Default login: `admin` / `admin`

3. **Configure Services**:
   - Go to Settings (admin only)
   - Configure Readarr connection
   - Set up SMTP for Send to Kindle
   - Enable desired content types

4. **Set Folder Permissions**:
   Ensure the PUID/PGID user has appropriate permissions:
   ```bash
   # Check permissions
   docker exec novelarr ls -la /media
   docker exec novelarr ls -la /downloads
   ```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUID` | 1000 | User ID for file permissions |
| `PGID` | 1000 | Group ID for file permissions |
| `TZ` | UTC | Timezone for logs and schedules |
| `NODE_ENV` | production | Node environment |
| `DB_PATH` | /app/data/novelarr.db | Database location |
| `PORT` | 8096 | Web interface port |

## Volume Permissions

Novelarr respects your existing file permissions:

- **Media folders** (`/media/*`): Read-only access recommended
- **Download folders** (`/downloads/*`): Read/write for moving completed downloads
- **Config folder** (`/app/data`): Read/write for database and settings

## Backup and Restore

### Backup
```bash
# Backup database and configuration
docker exec novelarr sqlite3 /app/data/novelarr.db ".backup /app/data/backup.db"
tar -czf novelarr-backup.tar.gz ./config
```

### Restore
```bash
# Stop container
docker-compose down

# Restore files
tar -xzf novelarr-backup.tar.gz

# Start container
docker-compose up -d
```

## Troubleshooting

### Permission Issues
```bash
# Fix ownership
docker exec novelarr chown -R abc:abc /app/data

# Check user mapping
docker exec novelarr id
```

### Path Mapping Issues
```bash
# Verify paths inside container
docker exec novelarr ls -la /media/books
docker exec novelarr ls -la /downloads/books
```

### Database Issues
```bash
# Check database integrity
docker exec novelarr sqlite3 /app/data/novelarr.db "PRAGMA integrity_check"
```

## Security Considerations

1. **Use Read-Only Mounts**: Mount media folders as read-only (`:ro`)
2. **Secure Configuration**: Keep config folder permissions restrictive
3. **Network Isolation**: Use Docker networks to limit container communication
4. **Regular Updates**: Keep the container image updated

## Integration Examples

### With Readarr
```yaml
services:
  readarr:
    volumes:
      - /mnt/media/books:/books
      - /mnt/downloads/complete/books:/downloads/books
  
  novelarr:
    volumes:
      - /mnt/media/books:/media/books:ro
      - /mnt/downloads/complete/books:/downloads/books
```

### With Calibre-Web
```yaml
services:
  calibre-web:
    volumes:
      - /mnt/calibre:/books
  
  novelarr:
    volumes:
      - /mnt/calibre:/calibre:ro
```