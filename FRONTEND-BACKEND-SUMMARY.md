# Novelarr Frontend-Backend Summary

## Backend API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/register` - Register new user (requires admin token)
- `GET /api/auth/profile` - Get current user profile

### Search
- `GET /api/search?q={query}&source={all|readarr|jackett|prowlarr}` - Search books
- `GET /api/search/sources` - Get status of all search sources

### Requests
- `GET /api/requests` - Get all book requests
- `POST /api/requests` - Create new book request
- `PUT /api/requests/:id` - Update request status
- `DELETE /api/requests/:id` - Delete request

### Settings (Admin only)
- `GET /api/settings` - Get all settings
- `PUT /api/settings` - Update settings

### Users (Admin only)
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Current Frontend Structure

### Main Components
- `/frontend/src/App.vue` - Main app component with router-view
- `/frontend/src/router/index.js` - Vue Router configuration
- `/frontend/src/stores/auth.js` - Pinia auth store

### Views
- `/frontend/src/views/Login.vue` - Login page
- `/frontend/src/views/Dashboard.vue` - Main dashboard
- `/frontend/src/views/Search.vue` - Book search with source selection
- `/frontend/src/views/Requests.vue` - View/manage book requests
- `/frontend/src/views/Settings.vue` - Admin settings
- `/frontend/src/views/Users.vue` - User management

### Components
- `/frontend/src/components/BookCard.vue` - Display book with request button
- `/frontend/src/components/NavBar.vue` - Navigation bar

## Key Frontend Code Files

### BookCard.vue (current implementation)
- Shows book cover, title, author, year
- Shows source badge (Readarr/Jackett/Prowlarr)
- Shows torrent info (size, seeders, leechers, indexer)
- Has single "Request" button (only works for Readarr)
- Emits 'request' event when clicked

### Search.vue
- Has source selection radio buttons
- Fetches from `/api/search?q={query}&source={source}`
- Shows loading spinner while searching
- Displays results using BookCard components
- Handles book request via API

### Users.vue
- Shows user list with username, role, created date
- Add/Edit user modal with username, password, role fields
- Delete user functionality
- Shows user statistics

### Auth Store (Pinia)
- Stores user object and JWT token
- Login/logout actions
- Token persisted in localStorage

## New Features Needed

### 1. Kindle Email Storage
- Add `kindle_email` field to users table
- Update user profile/settings to allow editing Kindle email
- Display in user management interface

### 2. SMTP Configuration
- Add SMTP settings to admin settings:
  - smtp_host
  - smtp_port
  - smtp_user
  - smtp_password
  - smtp_from_email
  - smtp_tls (boolean)

### 3. Book Conversion & Send
- New endpoint: `POST /api/books/convert` - Convert book to EPUB
- New endpoint: `POST /api/books/send-kindle` - Send to user's Kindle
- Update BookCard component to show:
  - "Convert to EPUB" button (if not already EPUB)
  - "Send to Kindle" button (if user has Kindle email)

### 4. Database Schema Changes
```sql
-- Add to users table
ALTER TABLE users ADD COLUMN kindle_email TEXT;

-- Add SMTP settings
INSERT INTO settings (key, value, description) VALUES
  ('smtp_host', '', 'SMTP server hostname'),
  ('smtp_port', '587', 'SMTP server port'),
  ('smtp_user', '', 'SMTP username'),
  ('smtp_password', '', 'SMTP password'),
  ('smtp_from_email', '', 'From email address'),
  ('smtp_tls', 'true', 'Use TLS for SMTP');
```

## Book Data Structure
```javascript
{
  goodreadsId: string,
  title: string,
  author: string,
  year: number,
  coverUrl: string,
  overview: string,
  ratings: number,
  pageCount: number,
  source: 'Readarr' | 'Jackett' | 'Prowlarr',
  // For torrents:
  size: string,
  seeders: number,
  leechers: number,
  indexer: string,
  downloadUrl: string,
  infoUrl: string,
  files: number
}
```

## Current Tech Stack
- Frontend: Vue 3, Vite, Tailwind CSS, Pinia
- Backend: Express.js, SQLite (better-sqlite3), JWT auth
- Conversion: Will need Calibre or similar for EPUB conversion
- Email: Will need nodemailer for SMTP