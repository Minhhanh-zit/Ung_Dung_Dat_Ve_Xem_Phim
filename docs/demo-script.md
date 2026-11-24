# CineHunt Demo Script

## Preparation

1. Start the production stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

2. Confirm health:

```bash
bash scripts/healthcheck.sh
```

3. Open the admin web at `http://localhost/`.

## Demo flow

1. Sign in as an administrator.
2. Show movie, showtime, theater and room management.
3. Sign in as a customer.
4. Search for a movie and open its details.
5. Select a showtime.
6. Select seats and hold them temporarily.
7. Create a booking.
8. Choose a payment method and show that the payment remains `PENDING` unless real payment integration is configured.
9. Display the customer's ticket/order list.
10. Demonstrate AI movie recommendations.
11. Demonstrate fallback recommendations when interaction data is insufficient.

## Failure demonstration

1. Stop the AI service:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml stop ai
```

2. Show that the application handles the unavailable recommendation service gracefully.

3. Restart it:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml start ai
```
