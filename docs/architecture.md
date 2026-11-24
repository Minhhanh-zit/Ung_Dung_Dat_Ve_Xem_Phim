# CineHunt Architecture

## Components

| Component | Technology | Responsibility |
|---|---|---|
| Backend | NestJS, TypeORM | Business API, authentication, bookings, payments, administration |
| Admin web | React, TypeScript, Vite, Nginx | Administrative interface |
| AI | Python, FastAPI | Movie recommendation service |
| Database | SQL Server | Persistent business data |
| Deployment | Docker Compose, GitHub Actions | Packaging, testing and deployment |

## Runtime topology

```text
Browser / Mobile
        |
        v
admin-web (Nginx)
        |
        v
backend (NestJS) --> SQL Server
        |
        v
ai (FastAPI)
```

## Network and ports

- Backend: container port `3000`; host port configurable through `BACKEND_BIND`
- Admin web: container port `80`; host port `80` by default
- AI: internal port `8000`; not exposed directly to the Internet
- SQL Server: container port `1433`; host port bound to localhost by default

## Data persistence

- `sqlserver_data`: SQL Server database files
- `backend_uploads`: uploaded files
- `ai_models`: trained AI model artifacts

## Security notes

- Secrets are supplied through environment variables, never committed to Git.
- AI service is only reachable inside the Compose network.
- Swagger is disabled in production.
- Payment status must not be automatically marked successful without a real payment integration.
