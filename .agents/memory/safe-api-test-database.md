---
name: Safe API test database
description: Prevent backend API tests from connecting to the shared database through dotenv-loaded credentials.
---

Backend API tests must explicitly disable remote database configuration before importing or initializing the server/database modules, then use a temporary SQLite path.

**Why:** The application loads `.env` while the server is imported. If the test process inherits complete database settings, a test intended to be isolated can write users, carts, orders, and refresh tokens to the configured shared database.

**How to apply:** Set the remote database environment variables to empty values and set `SQLITE_PATH` to a temporary file at test startup. Clean up any fixture data if a prior run connected to the shared database.