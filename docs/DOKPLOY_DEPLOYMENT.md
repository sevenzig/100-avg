# Dokploy Deployment Guide for SvelteKit Docker Apps

This guide covers deploying SvelteKit applications with `@sveltejs/adapter-node` to Dokploy.

## Prerequisites

- Dokploy instance running with Traefik
- Git repository with your SvelteKit app
- Domain configured in DNS pointing to your Dokploy server

## Critical Configuration Requirements

### 1. Environment Variables

Set these in Dokploy's app environment settings:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `HOST` | Yes | **Must be `0.0.0.0`** - binds to all interfaces |
| `PORT` | Yes | Internal port (default: `3000`) |
| `ORIGIN` | Yes | Your full domain with protocol: `https://yourdomain.com` |
| `PROTOCOL_HEADER` | Yes | Set to `x-forwarded-proto` for Traefik |
| `HOST_HEADER` | Yes | Set to `x-forwarded-host` for Traefik |

Example:
```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
ORIGIN=https://myapp.example.com
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
```

### 2. Dockerfile Requirements

```dockerfile
# Use multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/build ./build

# Critical: These environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000
CMD ["node", "build"]
```

### 3. docker-compose.yml for Dokploy

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    expose:
      - "3000"  # Use 'expose', NOT 'ports' - Traefik handles routing
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=3000
      - ORIGIN=${ORIGIN:-https://yourdomain.com}
      - PROTOCOL_HEADER=x-forwarded-proto
      - HOST_HEADER=x-forwarded-host
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
```

## Common Issues and Solutions

### 502 Bad Gateway

**Cause:** App binding to `127.0.0.1` instead of `0.0.0.0`

**Fix:** Set `HOST=0.0.0.0` in environment variables

### 400 Bad Request

**Cause:** ORIGIN mismatch or missing forwarded headers

**Fix:**
1. Set `ORIGIN` to your exact domain with protocol
2. Add `PROTOCOL_HEADER=x-forwarded-proto`
3. Add `HOST_HEADER=x-forwarded-host`

### Port Already Allocated

**Cause:** Using `ports` instead of `expose` in docker-compose

**Fix:** Change `ports: - "3000:3000"` to `expose: - "3000"`

### env_file Not Found

**Cause:** `.env.production` is in `.gitignore` and not in repo

**Fix:** Remove `env_file` from docker-compose and set variables directly or via Dokploy dashboard

### Database Volume Empty

**Cause:** Named volume created empty, overwriting container data

**Fix:**
1. Delete the volume: `docker volume rm <volume-name>`
2. Bake seed database into image (temporarily)
3. Redeploy - Docker copies container data to empty volume

## File Checklist

### .dockerignore
Ensure these are NOT ignored if needed in build:
- Source files (`src/`)
- Package files (`package.json`, `package-lock.json`)
- Static assets (`static/`)
- Database seed file (if seeding)

Ensure these ARE ignored:
- `node_modules/`
- `.env*` files
- `build/` (rebuilt in container)
- `.svelte-kit/`

### .gitignore
Keep sensitive files out of repo:
- `.env.production`
- `database/*.db` (after initial seed)
- Secrets and credentials

## Dokploy Dashboard Settings

1. **Source:** Git repository
2. **Branch:** `main` (or your production branch)
3. **Build:** Docker Compose
4. **Compose File:** `docker-compose.prod.yml`
5. **Domain:** Your domain (e.g., `myapp.example.com`)
6. **HTTPS:** Enabled (Let's Encrypt)
7. **Port:** `3000` (internal container port)

## Environment Variables in Dokploy

Set these in the "Environment" tab of your app:

```
JWT_SECRET=your-secure-secret-here
ORIGIN=https://yourdomain.com
```

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Health Checks

Dokploy/Traefik uses health checks to determine container readiness:

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 10s  # Give app time to start
```

## Troubleshooting Commands

```bash
# Check container status
docker ps -a

# View container logs
docker logs <container-name> --tail 100

# Test from inside Dokploy server
curl -v http://localhost:3000

# Test with forwarded headers
curl -H "X-Forwarded-Proto: https" -H "X-Forwarded-Host: yourdomain.com" http://localhost:3000

# Remove stuck volume
docker stop <container> && docker rm <container> && docker volume rm <volume>
```

## Quick Reference

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | `HOST=0.0.0.0` |
| 400 Bad Request | Set `ORIGIN`, `PROTOCOL_HEADER`, `HOST_HEADER` |
| Port conflict | Use `expose` not `ports` |
| Empty database | Delete volume, redeploy |
| env_file error | Remove `env_file`, use Dokploy env settings |
