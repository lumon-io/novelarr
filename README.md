# Novelarr 📚

A Docker-first book request management system with multi-source search capabilities. Search across Readarr, Jackett, and Prowlarr to find and request books.

## Features

- 🔍 **Multi-Source Search**: Search books across Readarr, Jackett, and Prowlarr simultaneously
- 📚 **Kavita Integration**: Check library status and open books directly in Kavita
- 👥 **Multi-User Support**: Role-based access control (Admin/User)
- 🔐 **JWT Authentication**: Secure token-based authentication
- 📖 **Goodreads Integration**: Sync your reading history and shelves
- 🤖 **AI Recommendations**: Get personalized book recommendations powered by OpenAI
- 🎨 **Modern UI**: Vue 3 with Tailwind CSS
- 🐳 **Docker First**: Single container deployment
- 📱 **Responsive Design**: Works on desktop and mobile
- ⚙️ **Web-Based Configuration**: Configure all settings through the admin panel - no file editing required!

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/lumon-io/novelarr.git
cd novelarr
```

2. Build and run with Docker:
```bash
docker-compose up --build
```

3. Access the UI at `http://localhost:8096`

4. Default credentials:
   - Username: `admin`
   - Password: `admin123`

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

## License

MIT