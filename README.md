# GCBank Monorepo (Backend + Mobile)

Monorepo containing:
- `api/` — Node + Express + PostgreSQL backend (Dockerized)
- `mobile/` — Expo React Native app with NativeWind (Tailwind-like) styling

## Quick start

1. Clone (or unzip) this repo and `cd` to its root.

2. Copy env files:
   ```bash
   cp .env.example .env
   cp api/.env.example api/.env
   ```

3. Start backend & DB:
   ```bash
   docker-compose up --build
   ```

4. Initialize DB schema (wait until DB is ready):
   ```bash
   # requires psql on host; or run inside container
   psql "$DATABASE_URL" -f 001_schema.sql
   ```

5. Start mobile app:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```

6. Register a user (example):
   ```bash
   curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" \
     -d '{"email":"alice@example.com","password":"password123"}'
   ```

7. Login to get JWT, then open mobile app and paste token in demo flow.
