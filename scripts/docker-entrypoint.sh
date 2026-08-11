#!/bin/sh
set -e

DB_DIR="$(dirname "${DATABASE_PATH:-/app/database/wingspan.db}")"
mkdir -p "$DB_DIR"

# Named volumes often mount as root; fix ownership then drop privileges
if [ "$(id -u)" = "0" ]; then
	chown -R nodejs:nodejs "$DB_DIR"
	exec su-exec nodejs "$@"
fi

exec "$@"
