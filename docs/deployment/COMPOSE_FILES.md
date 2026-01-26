# Docker Compose Files Overview

## docker-compose.yml (Development)

**Purpose**: Local development environment with hot-reload support.

**Key Features**:
- Hot-reload enabled via source code volume mounts
- Development server on port `5173`
- Persistent database volume (`wingspan-db-dev`)
- Loads configuration from `.env` file
- Uses `Dockerfile.dev` for development build

**Usage**:
```bash
docker-compose up
```

## docker-compose.prod.yml (Production)

**Purpose**: Optimized production deployment configuration.

**Key Features**:
- Multi-stage production build from `Dockerfile`
- Production server on port `3000` (configurable)
- Persistent database volume (`wingspan-db-prod`)
- Health checks for container orchestration
- Loads configuration from `.env.production` file
- Runs as non-root user for security

**Usage**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Differences

| Feature | Development | Production |
|---------|------------|------------|
| **Port** | 5173 | 3000 |
| **Hot Reload** | ✅ Yes | ❌ No |
| **Source Mounts** | ✅ Yes | ❌ No |
| **Build** | Dockerfile.dev | Dockerfile (multi-stage) |
| **Health Checks** | ❌ No | ✅ Yes |
| **Database Volume** | wingspan-db-dev | wingspan-db-prod |
| **Environment File** | .env | .env.production |
