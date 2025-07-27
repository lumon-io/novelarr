# Novelarr 📚

A Docker-first book request management system with multi-source search capabilities. Search across Readarr, Jackett, and Prowlarr to find and request books.

## Features

- 🔍 **Multi-Source Search**: Search books across Readarr, Jackett, and Prowlarr simultaneously
- 👥 **Multi-User Support**: Role-based access control (Admin/User)
- 🔐 **JWT Authentication**: Secure token-based authentication
- 🎨 **Modern UI**: Vue 3 with Tailwind CSS
- 🐳 **Docker First**: Single container deployment
- 📱 **Responsive Design**: Works on desktop and mobile
- ⚙️ **Admin Panel**: Configure all integrations from the UI

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/novelarr.git
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

### Service Integration

Configure these services in the Admin Settings panel:

- **Readarr**: Your Readarr instance URL and API key
- **Jackett**: Your Jackett instance URL and API key  
- **Prowlarr**: Your Prowlarr instance URL and API key

### Environment Variables

Create a `.env` file:
```env
JWT_SECRET=your-secret-key
DB_PATH=/config/novelarr.db
PORT=8096
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

## Upcoming Features

- 📧 Send to Kindle functionality
- 📖 EPUB conversion for non-EPUB formats
- 📨 SMTP email integration

## License

MIT