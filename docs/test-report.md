# CineHunt Test Report

## Scope

This report records functional and deployment checks for the CineHunt system.

## Automated checks

| Area | Command / workflow | Expected result |
|---|---|---|
| Backend build and tests | `.github/workflows/ci.yml` | Build and tests pass |
| Web checks | `.github/workflows/ci.yml` | Build and tests pass |
| AI smoke test | `.github/workflows/cinehunt-auto-tests.yml` | Smoke test passes |
| Mobile checks | `.github/workflows/mobile-checks.yml` | TypeScript and Expo checks pass |
| Code quality | `.github/workflows/sonarqube.yml` | SonarQube analysis completes |

## Manual business-flow checklist

- [ ] Customer registration
- [ ] Customer login
- [ ] Staff/admin login
- [ ] Movie search and detail
- [ ] Showtime selection
- [ ] Seat selection
- [ ] Temporary seat hold
- [ ] Booking creation
- [ ] Payment method selection
- [ ] Payment remains `PENDING` unless a real payment integration confirms it
- [ ] Ticket/order list
- [ ] Check-in or ticket validation, if available
- [ ] Admin movie/showtime/theater management
- [ ] AI recommendation
- [ ] AI fallback when interaction data is unavailable

## Deployment smoke test

- [ ] `docker compose ps` shows all services healthy
- [ ] Backend `/health` returns HTTP 200
- [ ] Admin web loads successfully
- [ ] Backend can connect to SQL Server
- [ ] Backend can call AI service
- [ ] Web proxy `/api` reaches backend
- [ ] Mobile uses a LAN/server address rather than `localhost`

## Evidence

Attach pipeline screenshots, container logs, API responses and demo video links here before submission.
