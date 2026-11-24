# CineHunt Deployment Guide

## Requirements

- Docker Engine and Docker Compose v2
- A server or local machine with ports 80 and optionally 1433 available
- SQL Server-compatible credentials and database name
- Strong, unique JWT secrets

## 1. Prepare environment

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set:

- `MSSQL_SA_PASSWORD`
- `DB_PASSWORD`
- `DB_DATABASE`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`

Do **not** commit `.env.production`.

## 2. Initialize database

For a new demo database, run the safe schema and seed scripts from `database/safe/` after SQL Server is healthy:

```bash
docker compose -f docker-compose.prod.yml up -d sqlserver
docker compose -f docker-compose.prod.yml ps
```

Then execute the SQL scripts using your preferred SQL Server client. Do not run scripts containing `DROP TABLE` against an existing production database.

## 3. Start all services

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Check service status:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

## 4. Verify services

- Backend health: `http://localhost:3000/health`
- Admin web: `http://localhost/`
- AI service: internal address `http://ai:8000`

## 5. Logs and rollback

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f ai
```

Rollback:

```bash
bash scripts/rollback.sh
```

The rollback script stops the current stack and restarts it from the previously built local images. For image-tag-based rollback, retain the previous image tags in your registry and update the Compose image references before redeploying.
