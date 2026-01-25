# Dockerization Strategy for Wingspan Score Tracker

## 📋 Executive Summary

This document outlines a comprehensive strategy for containerizing the Wingspan Score Tracker application using Docker. The application is a SvelteKit-based web application with SQLite database, JWT authentication, and server-side API routes.

## 🎯 Objectives

1. **Containerize the application** for consistent deployment across environments
2. **Persist database data** across container restarts
3. **Support both development and production** workflows
4. **Optimize build process** for faster iteration and smaller images
5. **Enable easy scaling** and deployment to container orchestration platforms

## 🏗️ Architecture Analysis

### Current Stack
- **Framework**: SvelteKit 2.0
- **Runtime**: Node.js (requires 18+)
- **Database**: SQLite (better-sqlite3) - file-based, requires native compilation
- **Build Tool**: Vite 5.0
- **Adapter**: `@sveltejs/adapter-auto` (needs to change to `adapter-node`)
- **Authentication**: JWT with httpOnly cookies
- **Dependencies**: Native modules (better-sqlite3 requires compilation)

### Key Considerations

1. **Native Dependencies**: `better-sqlite3` requires native compilation
   - Solution: Use Node.js base image with build tools
   - Multi-stage build to optimize final image size

2. **Database Persistence**: SQLite file must persist across container restarts
   - Solution: Docker volume for `/app/database` directory

3. **Environment Variables**: 
   - `DATABASE_PATH` (defaults to `./database/wingspan.db`)
   - `JWT_SECRET` (required, must be secure)
   - `NODE_ENV` (development/production)
   - `PORT` (optional, for production)

4. **Adapter Change**: Must switch from `adapter-auto` to `adapter-node`
   - Required for proper Node.js server deployment in Docker

5. **Database Initialization**: Auto-initializes via `hooks.server.ts`
   - No manual migration needed, but volume must be writable

## 🐳 Docker Strategy Options

### Option 1: Single-Stage Build (Simple)
**Pros:**
- Simple Dockerfile
- Faster initial setup
- Good for development

**Cons:**
- Larger final image (includes build tools)
- Slower builds
- Not optimized for production

### Option 2: Multi-Stage Build (Recommended) ⭐
**Pros:**
- Smaller final image (only runtime dependencies)
- Optimized for production
- Better security (fewer packages)
- Faster container startup

**Cons:**
- Slightly more complex Dockerfile
- Requires careful dependency management

### Option 3: Development + Production Compose
**Pros:**
- Separate configs for dev/prod
- Hot reload in development
- Production optimizations
- Best of both worlds

**Cons:**
- More files to maintain
- Slightly more complex setup

## 📦 Recommended Approach: Multi-Stage with Dev/Prod Support

### Architecture Decision

**Multi-stage Dockerfile** with:
1. **Build stage**: Install dependencies, compile native modules, build application
2. **Production stage**: Copy only runtime files, minimal Node.js image

**Docker Compose** with:
1. **Development**: Volume mounts, hot reload, development dependencies
2. **Production**: Optimized build, minimal volumes, production settings

## 🔧 Implementation Plan

### Phase 1: Core Docker Setup

#### 1.1 Update SvelteKit Adapter
- Change from `@sveltejs/adapter-auto` to `@sveltejs/adapter-node`
- Configure for Node.js server deployment
- Update `svelte.config.js`

#### 1.2 Create Dockerfile
- Multi-stage build (build + production)
- Install build dependencies for native modules
- Optimize layer caching
- Set proper working directory
- Configure non-root user for security

#### 1.3 Create .dockerignore
- Exclude unnecessary files from build context
- Reduce build time and image size

### Phase 2: Docker Compose Configuration

#### 2.1 Development Compose
- Volume mounts for source code (hot reload)
- Volume for database persistence
- Development environment variables
- Port mapping for local access

#### 2.2 Production Compose
- Built image usage
- Database volume persistence
- Production environment variables
- Health checks
- Restart policies

### Phase 3: Environment Configuration

#### 3.1 Environment Files
- `.env.development` for local development
- `.env.production` for production
- `.env.docker` for Docker-specific overrides

#### 3.2 Environment Variable Management
- Secure JWT_SECRET generation
- Database path configuration
- Port configuration
- Node environment settings

### Phase 4: Database Management

#### 4.1 Volume Strategy
- Named volume for database persistence
- Backup/restore procedures
- Migration support

#### 4.2 Initialization
- Auto-initialization via hooks (already implemented)
- Optional seed scripts in Docker
- Health checks for database readiness

### Phase 5: Optimization & Best Practices

#### 5.1 Image Optimization
- Use specific Node.js version (not latest)
- Minimize layers
- Use .dockerignore effectively
- Multi-stage build optimization

#### 5.2 Security
- Non-root user in container
- Minimal base image
- No secrets in image
- Proper file permissions

#### 5.3 Development Experience
- Hot reload support
- Easy database access
- Logging configuration
- Debug support

## 📝 File Structure

```
wingspan-score/
├── Dockerfile                 # Multi-stage production build
├── Dockerfile.dev            # Development Dockerfile (optional)
├── docker-compose.yml        # Development configuration
├── docker-compose.prod.yml   # Production configuration
├── .dockerignore             # Files to exclude from build
├── .env.docker               # Docker-specific environment
└── DOCKERIZATION_STRATEGY.md # This document
```

## 🔄 Workflow Integration

### Development Workflow
```bash
# Start development environment
docker-compose up

# Run database scripts
docker-compose exec app npm run seed

# View logs
docker-compose logs -f app

# Stop environment
docker-compose down
```

### Production Workflow
```bash
# Build production image
docker-compose -f docker-compose.prod.yml build

# Start production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop production
docker-compose -f docker-compose.prod.yml down
```

## 🚀 Deployment Considerations

### Container Registry
- Docker Hub
- GitHub Container Registry
- Private registry (AWS ECR, GCR, etc.)

### Orchestration Platforms
- **Docker Swarm**: Simple orchestration
- **Kubernetes**: Full orchestration (if scaling needed)
- **Cloud Platforms**: AWS ECS, Google Cloud Run, Azure Container Instances

### Scaling Considerations
- SQLite is single-writer (not ideal for horizontal scaling)
- Consider PostgreSQL migration for multi-instance deployments
- Current design supports single-instance deployment well

## ⚠️ Limitations & Future Considerations

### Current Limitations
1. **SQLite**: Single-writer database, not ideal for horizontal scaling
2. **File-based**: Requires volume management
3. **No built-in backup**: Requires manual backup procedures

### Future Enhancements
1. **PostgreSQL migration**: For multi-instance deployments
2. **Health check endpoints**: For orchestration platforms
3. **Metrics/monitoring**: Integration with monitoring tools
4. **Automated backups**: Cron jobs or sidecar containers
5. **CI/CD integration**: Automated builds and deployments

## 📊 Success Criteria

✅ Application runs in Docker container
✅ Database persists across restarts
✅ Development workflow supports hot reload
✅ Production build is optimized (< 500MB image)
✅ Environment variables properly configured
✅ Security best practices followed
✅ Documentation complete and clear

## 🎯 Next Steps

1. **Review and approve** this strategy
2. **Implement Phase 1**: Core Docker setup
3. **Test development workflow**: Verify hot reload and database persistence
4. **Test production build**: Verify optimized image and runtime
5. **Document usage**: Update README with Docker instructions
6. **Deploy to staging**: Test in staging environment
7. **Deploy to production**: Final deployment

---

**Status**: 📋 Strategy Document Complete
**Next Action**: Implementation of Phase 1
