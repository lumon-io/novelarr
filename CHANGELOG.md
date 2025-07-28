# Novelarr Changelog

## [Unreleased] - 2025-07-28

### Added
- **Send to Kindle** functionality
  - SMTP email configuration in admin settings
  - Per-user Kindle email configuration
  - One-click send for downloaded books
  - Support for all Kindle-compatible formats
  - Send history tracking

- **Multi-Content Type Support**
  - Books, Audiobooks, Magazines, Comics, and Manga categories
  - Dedicated folder structure for each content type
  - Content type selector in search interface
  - Per-type enable/disable settings
  - Separate quality profiles per content type

- **Production Docker Deployment**
  - PUID/PGID support for proper file permissions
  - Comprehensive volume mapping structure
  - docker-init.sh for permission management
  - Example docker-compose.yml with all options
  - Health check endpoint
  - Multi-architecture support (AMD64/ARM64)

- **Enhanced UI Components**
  - User Profile page for personal settings
  - Content type selector component
  - Send to Kindle button on completed downloads
  - Content type display in requests list

### Changed
- Updated docker-compose.yml with proper volume structure
- Enhanced Dockerfile with permission handling
- Improved README with deployment instructions
- Default admin password changed to 'admin123'

### Database Migrations
- 008_kindle_email.sql - Added kindle_email field to users
- 009_kindle_sends.sql - Created kindle_sends tracking table
- 010_content_categories.sql - Added content type support

### API Changes
- New `/api/kindle/*` endpoints for Kindle functionality
- New `/api/content-types/*` endpoints for content management
- Updated `/api/requests` to support content_type field

### Documentation
- Added DOCKER-DEPLOYMENT.md with comprehensive deployment guide
- Added KINDLE-IMPLEMENTATION.md with Send to Kindle details
- Updated README.md with new features

## Previous Releases

### [Initial] - 2025-07-27
- Multi-source search (Readarr, Jackett, Prowlarr)
- Kavita integration
- Multi-user support with role-based access
- Goodreads integration
- AI recommendations
- Web-based configuration