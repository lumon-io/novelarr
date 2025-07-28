#!/bin/sh
set -e

# Set user and group IDs
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting Novelarr with UID: $PUID and GID: $PGID"

# Create group if it doesn't exist
if ! getent group novelarr > /dev/null 2>&1; then
    addgroup -g $PGID -S novelarr
fi

# Create user if it doesn't exist
if ! getent passwd novelarr > /dev/null 2>&1; then
    adduser -u $PUID -S -G novelarr novelarr
fi

# Update existing user/group IDs if needed
if [ "$(id -u novelarr)" != "$PUID" ]; then
    usermod -u $PUID novelarr
fi

if [ "$(id -g novelarr)" != "$PGID" ]; then
    groupmod -g $PGID novelarr
fi

# Set ownership for all required directories
chown -R novelarr:novelarr \
    /app \
    /app/data \
    /media \
    /downloads

# Create subdirectories if they don't exist
for dir in books audiobooks magazines comics; do
    mkdir -p "/media/$dir" "/downloads/$dir"
    chown -R novelarr:novelarr "/media/$dir" "/downloads/$dir"
done

# Initialize database if it doesn't exist
if [ ! -f "/app/data/novelarr.db" ]; then
    echo "Initializing database..."
    su-exec novelarr:novelarr node -e "require('./db/database').initDatabase()"
fi

# Execute the main command as the novelarr user
exec su-exec novelarr:novelarr "$@"