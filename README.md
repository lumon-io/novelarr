# Novelarr 📚

A Docker-first book request management system with multi-source search capabilities. Search across Readarr, Jackett, and Prowlarr to find and request books.

## Features

- 🔍 **Multi-Source Search**: Search books across Readarr, Jackett, and Prowlarr simultaneously
- 📚 **Multi-Content Support**: Books, Audiobooks, Magazines, Comics, and Manga
- 📖 **Kavita Integration**: Check library status and open books directly in Kavita
- 📧 **Send to Kindle**: Email books directly to your Kindle device
- 👥 **Multi-User Support**: Role-based access control (Admin/User)
- 🔐 **JWT Authentication**: Secure token-based authentication
- 📖 **Goodreads Integration**: Sync your reading history and shelves
- 🤖 **AI Recommendations**: Get personalized book recommendations powered by OpenAI
- 🎨 **Modern UI**: Vue 3 with Tailwind CSS
- 🐳 **Docker First**: Production-ready container with PUID/PGID support
- 📱 **Responsive Design**: Works on desktop and mobile
- ⚙️ **Web-Based Configuration**: Configure all settings through the admin panel - no file editing required!

## Quick Start

### Using Docker Compose (Recommended)

1. Create a `docker-compose.yml` file:
```yaml
version: '3.8'

services:
  novelarr:
    image: novelarr:latest
    container_name: novelarr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
    volumes:
      - ./config:/app/data
      - /path/to/media:/media
      - /path/to/downloads:/downloads
    ports:
      - "8096:8096"
    restart: unless-stopped
```

2. Start the container:
```bash
docker-compose up -d
```

3. Access the UI at `http://localhost:8096`

4. Default credentials:
   - Username: `admin`
   - Password: `admin123`

See [DOCKER-DEPLOYMENT.md](DOCKER-DEPLOYMENT.md) for detailed deployment instructions.

## Configuration

All configuration is done through the web interface - no file editing required!

### Admin Settings Panel

Navigate to Settings (admin only) to configure:

#### Service Integrations
- **Readarr**: URL and API key for book downloads
- **Jackett**: URL and API key for torrent indexing (optional)
- **Prowlarr**: URL and API key for unified indexing (optional)
- **Kavita**: URL and API key for library integration (optional)

#### Goodreads & AI
- **Goodreads OAuth**: API key, secret, and callback URL
- **OpenAI**: API key and model selection for AI recommendations

#### General Settings
- Registration enable/disable
- Default user role
- Request limits and approval settings

### Environment Variables (Optional)

Only these core settings use environment variables:
```env
JWT_SECRET=your-secret-key      # Security token secret
SESSION_SECRET=your-secret      # Session encryption
DB_PATH=/config/novelarr.db     # Database location
PORT=8096                       # Server port
```

## Development

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Documentation

See [FRONTEND-BACKEND-SUMMARY.md](./FRONTEND-BACKEND-SUMMARY.md) for detailed API documentation.

## Usage Guide

### For Users
1. **Search**: Use the search page to find books across all configured sources
2. **Recommendations**: Connect Goodreads to get AI-powered book suggestions
3. **Library**: Browse your synced Goodreads reading history
4. **Requests**: Track your book requests and download status

### For Admins
1. Go to Settings to configure all integrations
2. Test each connection before saving
3. Manage users and their permissions
4. Monitor all user requests

## Upcoming Features

- 📧 Send to Kindle functionality
- 📖 EPUB conversion for non-EPUB formats
- 📨 SMTP email integration

## Content Types

Novelarr supports multiple content types, each with dedicated folder structures:

- **📚 Books**: EPUB, MOBI, AZW3, PDF - integrated with Readarr
- **🎧 Audiobooks**: M4B, MP3 - integrated with Readarr + audiobook profiles
- **📰 Magazines**: PDF, EPUB - for periodicals and magazines
- **🎨 Comics**: CBR, CBZ - can integrate with Mylar3
- **📖 Manga**: CBZ, PDF - for manga collections

## Send to Kindle

Novelarr includes built-in Send to Kindle functionality:

1. Configure SMTP settings in the admin panel
2. Users add their Kindle email in their profile
3. One-click send for any downloaded book
4. Supports all Kindle-compatible formats

## Docker Deployment

Novelarr is designed for self-hosting with full support for:

- **PUID/PGID**: Proper file permissions
- **Volume Mapping**: Separate media, downloads, and config
- **Multi-Architecture**: AMD64 and ARM64 support
- **Health Checks**: Built-in container health monitoring
- **Resource Limits**: Configurable CPU/memory constraints

See [DOCKER-DEPLOYMENT.md](DOCKER-DEPLOYMENT.md) for complete deployment guide.

## License

MIT