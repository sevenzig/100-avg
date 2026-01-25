# Docker Setup Guide for Wingspan Score Tracker

This guide explains how to run the Wingspan Score Tracker application using Docker.

## 📋 Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Git (for cloning the repository)

## 🚀 Quick Start

### Development Mode

1. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set a secure `JWT_SECRET`:
   ```env
   DATABASE_PATH=./database/wingspan.db
   JWT_SECRET=your-secure-secret-here
   NODE_ENV=development
   ```

2. **Start the development environment:**
   ```bash
   docker-compose up
   ```

3. **Access the application:**
   - Open your browser to `http://localhost:5173`
   - The application will hot-reload on code changes

4. **Stop the environment:**
   ```bash
   docker-compose down
   ```

### Production Mode

1. **Set up production environment:**
   ```bash
   cp .env.example .env.production
   ```
   
   Edit `.env.production` with production values:
   ```env
   DATABASE_PATH=/app/database/wingspan.db
   JWT_SECRET=your-production-secret-here
   NODE_ENV=production
   PORT=3000
   ```

2. **Build and start:**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Access the application:**
   - Open your browser to `http://localhost:3000` (or your configured PORT)

4. **View logs:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

5. **Stop the environment:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

## 🛠️ Common Operations

### Database Management

**Seed the database:**
```bash
# Development
docker-compose exec app npm run seed

# Production
docker-compose -f docker-compose.prod.yml exec app npm run seed
```

**Run database scripts:**
```bash
# Development
docker-compose exec app npm run check-db
docker-compose exec app npm run migrate

# Production
docker-compose -f docker-compose.prod.yml exec app npm run check-db
```

### Viewing Logs

```bash
# Development
docker-compose logs -f app

# Production
docker-compose -f docker-compose.prod.yml logs -f app
```

### Accessing Container Shell

```bash
# Development
docker-compose exec app sh

# Production
docker-compose -f docker-compose.prod.yml exec app sh
```

### Rebuilding Containers

```bash
# Development
docker-compose build --no-cache
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## 💾 Database Persistence

The database is stored in a Docker volume and persists across container restarts:

- **Development**: `wingspan-db-dev` volume
- **Production**: `wingspan-db-prod` volume

### Backup Database

```bash
# Development
docker-compose exec app sh -c "cp /app/database/wingspan.db /app/database/wingspan.db.backup"

# Copy backup out of container
docker cp wingspan-score-dev:/app/database/wingspan.db.backup ./backup.db
```

### Restore Database

```bash
# Copy backup into container
docker cp ./backup.db wingspan-score-dev:/app/database/wingspan.db

# Restart container
docker-compose restart app
```

### Remove Database (Start Fresh)

```bash
# Development
docker-compose down -v
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_PATH` | Path to SQLite database file | `/app/database/wingspan.db` | No |
| `JWT_SECRET` | Secret key for JWT tokens | - | Yes |
| `NODE_ENV` | Node environment | `development` | No |
| `PORT` | Server port | `3000` (prod) / `5173` (dev) | No |

### Port Configuration

- **Development**: Port `5173` (configurable in `docker-compose.yml`)
- **Production**: Port `3000` (configurable via `PORT` env var)

To change ports, edit the `ports` section in the appropriate `docker-compose*.yml` file.

## 🐛 Troubleshooting

### Container won't start

1. **Check logs:**
   ```bash
   docker-compose logs app
   ```

2. **Verify environment variables:**
   ```bash
   docker-compose exec app env | grep -E 'DATABASE_PATH|JWT_SECRET|NODE_ENV'
   ```

3. **Check database permissions:**
   ```bash
   docker-compose exec app ls -la /app/database
   ```

### Database errors

1. **Ensure database directory exists:**
   ```bash
   docker-compose exec app mkdir -p /app/database
   ```

2. **Check database file permissions:**
   ```bash
   docker-compose exec app chmod 755 /app/database
   ```

3. **Reinitialize database:**
   ```bash
   docker-compose exec app rm /app/database/wingspan.db
   docker-compose restart app
   ```

### Build errors

1. **Clear Docker cache:**
   ```bash
   docker system prune -a
   ```

2. **Rebuild without cache:**
   ```bash
   docker-compose build --no-cache
   ```

### Port already in use

If you get a "port already in use" error:

1. **Find what's using the port:**
   ```bash
   # Windows
   netstat -ano | findstr :5173
   
   # Linux/Mac
   lsof -i :5173
   ```

2. **Change the port in docker-compose.yml:**
   ```yaml
   ports:
     - "5174:5173"  # Use different host port
   ```

## 📦 Image Details

### Development Image
- **Base**: `node:20-alpine`
- **Size**: ~200-300MB
- **Includes**: All dependencies, source code, build tools

### Production Image
- **Base**: `node:20-alpine`
- **Size**: ~150-200MB (optimized)
- **Includes**: Only runtime dependencies, built application
- **User**: Runs as non-root user (`nodejs`)

## 🔒 Security Considerations

1. **JWT Secret**: Always use a strong, random secret in production
   ```bash
   # Generate secure secret
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Non-root user**: Production container runs as non-root user

3. **Minimal image**: Production image only includes necessary files

4. **Environment variables**: Never commit `.env` files with secrets

## 🚀 Deployment

### Docker Hub

1. **Build and tag:**
   ```bash
   docker build -t yourusername/wingspan-score:latest .
   ```

2. **Push to Docker Hub:**
   ```bash
   docker push yourusername/wingspan-score:latest
   ```

3. **Deploy:**
   ```bash
   docker run -d \
     -p 3000:3000 \
     -v wingspan-db:/app/database \
     -e JWT_SECRET=your-secret \
     yourusername/wingspan-score:latest
   ```

### Cloud Platforms

The application can be deployed to:
- **AWS ECS/Fargate**
- **Google Cloud Run**
- **Azure Container Instances**
- **DigitalOcean App Platform**
- **Heroku** (with Docker support)
- **Railway**
- **Fly.io**

Refer to platform-specific documentation for deployment instructions.

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [SvelteKit Adapter Node](https://kit.svelte.dev/docs/adapter-node)
- [Full Dockerization Strategy](./DOCKERIZATION_STRATEGY.md)

---

**Need help?** Check the [DOCKERIZATION_STRATEGY.md](./DOCKERIZATION_STRATEGY.md) for detailed architecture decisions and implementation details.
