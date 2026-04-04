# Deployment

## Docker (production)

Requires Docker with the Compose plugin.

```bash
# Start all services in the background
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

The frontend will be available at `http://localhost:18120`.

## Services

| Service  | Container     | Internal port | Exposed port |
|----------|---------------|---------------|--------------|
| backend  | met-backend   | 8000          | —            |
| frontend | met-frontend  | 3000          | 18120        |

The frontend communicates with the backend via the internal Docker network (`http://backend:8000`).
