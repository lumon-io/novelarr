# Novelarr Codebase Summary

## Project Overview
Novelarr is a Docker-first book request management system that integrates with the *arr ecosystem (Readarr, Jackett, Prowlarr) and provides additional features like Kavita integration, Goodreads syncing, and AI-powered recommendations.

## Technology Stack
- **Backend**: Node.js, Express.js, SQLite (better-sqlite3)
- **Frontend**: Vue 3, Vite, Tailwind CSS, Pinia
- **Authentication**: JWT tokens, bcrypt password hashing
- **Container**: Docker with multi-stage build
- **External APIs**: Goodreads OAuth, OpenAI GPT, Kavita, Readarr, Jackett, Prowlarr

## Key Features
1. **Multi-source Book Search**: Search across Readarr, Jackett, and Prowlarr
2. **User Management**: Multi-user support with admin/user roles
3. **Kavita Integration**: Check library status and open books in Kavita
4. **Goodreads Sync**: OAuth integration to import reading history
5. **AI Recommendations**: Personalized suggestions using OpenAI
6. **Request Management**: Track and manage book requests
7. **Web-based Configuration**: All settings manageable through UI

## Database Schema (7 migrations)
1. **001_initial.sql**: Core tables (users, requests, settings)
2. **002_downloads.sql**: Download tracking
3. **003_library.sql**: Library management (books, authors, genres, series)
4. **004_kavita.sql**: Kavita integration settings
5. **005_goodreads_integration.sql**: Goodreads OAuth and user books
6. **006_ai_settings.sql**: AI recommendations and caching
7. **007_web_config.sql**: Web-configurable settings and categories

## Backend Structure

### Core Files
- `server.js`: Express server setup, routes, graceful shutdown
- `config/index.js`: Configuration management
- `db/database.js`: SQLite initialization and migrations

### Routes (8 endpoints)
- `/api/auth`: Login, logout, session management
- `/api/search`: Multi-source book search
- `/api/requests`: Book request management
- `/api/settings`: Admin settings management
- `/api/users`: User management and API keys
- `/api/library`: Library browsing and management
- `/api/goodreads`: OAuth flow and book import
- `/api/recommendations`: AI recommendation generation

### Services (8 services)
- `readarr.js`: Readarr API integration
- `jackett.js`: Jackett torrent search
- `prowlarr.js`: Prowlarr indexer search
- `kavita.js`: Kavita library integration
- `goodreads.js`: Goodreads OAuth and API
- `aiRecommendations.js`: OpenAI recommendation engine
- `readarrSync.js`: Background sync service
- `configService.js`: Dynamic configuration management

### Middleware
- `auth.js`: JWT authentication and role-based access control

## Frontend Structure

### Main Components
- `App.vue`: Root component with layout
- `router.js`: Vue Router configuration
- `api.js`: Axios API client with auth interceptor
- `stores/auth.js`: Pinia auth store

### Views (7 pages)
- `Login.vue`: Authentication page
- `Search.vue`: Multi-source book search
- `Requests.vue`: Request management
- `Library.vue`: Browse Goodreads library
- `RecommendationsView.vue`: AI recommendations
- `Settings.vue`: Admin configuration
- `Users.vue`: User management

### Components (5 reusable)
- `NavBar.vue`: Navigation with auth status
- `BookCard.vue`: Book display with actions
- `SearchBar.vue`: Search input component
- `GoodreadsConnect.vue`: OAuth connection UI
- `AIRecommendations.vue`: Recommendation display

## Docker Configuration

### Dockerfile
- Multi-stage build (frontend build + backend runtime)
- Non-root user (novelarr:novelarr)
- Health check endpoint
- Volumes: /config (database), /books (library)

### docker-compose.yml
- Service: novelarr
- Port: 8096
- Environment variables for core settings
- Persistent volumes for config and books
- Restart policy: unless-stopped

## Security Features
1. **Authentication**: JWT with configurable expiry
2. **Password Security**: bcrypt hashing
3. **Session Management**: Express sessions for OAuth
4. **API Security**: Role-based access control
5. **Configuration**: All secrets stored in database, not files
6. **Git Security**: .gitignore, .gitattributes, .dockerignore

## Integration Points
1. **Readarr**: Book downloads and library management
2. **Jackett**: Torrent indexer search (optional)
3. **Prowlarr**: Unified indexer search (optional)
4. **Kavita**: eBook reader integration (optional)
5. **Goodreads**: Reading history import (optional)
6. **OpenAI**: AI recommendations (optional)

## Configuration Approach
- All settings stored in SQLite database
- Web UI for all configuration (no file editing)
- Services dynamically read settings via `updateConfig()`
- Fallback to environment variables during initial setup
- Settings organized by category for better UX

## Recent Additions
1. Goodreads OAuth integration
2. AI recommendation engine
3. Library view for imported books
4. Web-based configuration for all services
5. Enhanced security measures for git

## File Statistics
- Total Files: ~50 source files
- Backend: 20 JS files
- Frontend: 12 Vue components, 7 views
- Database: 7 migration files
- Configuration: Docker, package.json, build configs

## API Patterns
- RESTful endpoints
- JWT authentication via Bearer token
- Consistent error responses
- Request/response validation
- Graceful error handling

## Development Workflow
1. Local development with hot reload
2. Docker build for production
3. SQLite with WAL mode for performance
4. Database migrations run automatically
5. Graceful shutdown handling

This codebase represents a well-structured, modern web application with clear separation of concerns, comprehensive error handling, and a focus on user experience through web-based configuration.