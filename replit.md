# SAVX Store Migration Notes

## Project Overview
- Node.js/Express e-commerce storefront served from `backend/server.js`.
- Static frontend assets are served from `docs/` with product images from `products/`.
- API routes live under `backend/routes/`.

## Replit Runtime
- The server binds to `0.0.0.0` and uses `process.env.PORT`, falling back to port `3000` when unset.
- The Replit workflow sets `PORT=5000`, so the web preview is served on port 5000.
- Root script: `npm start` runs `node backend/server.js`.

## Database Behavior
- If complete MySQL credentials are available (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`), the app uses the existing MySQL/Aiven connection.
- If remote credentials are incomplete or unavailable, the app falls back to a local SQLite database at `.data/savx-store.sqlite` for Replit development.
- Local SQLite data is intentionally ignored by git.

## User Preferences
- Preserve the imported project structure and dependencies; do not rewrite from scratch.
