#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Install exactly the dependencies recorded in package-lock.json.
npm ci --no-audit --no-fund

# Prevent dotenv or inherited Replit environment values from directing
# regression tests to the shared MySQL database. Tests use temporary SQLite.
export DB_HOST=""
export DB_USER=""
export DB_PASSWORD=""
export DB_NAME=""
export DB_PORT=""

npm test