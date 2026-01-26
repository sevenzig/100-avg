# Multi-stage Dockerfile for Wingspan Score Tracker
# Stage 1: Build stage
# Using latest Node.js 20 LTS with security patches (includes OpenSSL fixes)
FROM node:20.18-alpine AS builder

# Build arguments for flexibility
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=1.0.0

# Add metadata labels
LABEL org.opencontainers.image.title="Wingspan Score Tracker" \
      org.opencontainers.image.description="SvelteKit application for tracking Wingspan game scores" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="Wingspan Score Tracker" \
      maintainer="Wingspan Score Tracker Team"

# Install build dependencies for native modules (better-sqlite3)
# Combine RUN commands to reduce layers and improve caching
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
# Include package-lock.json for reproducible builds
COPY package.json package-lock.json ./

# Install dependencies (including dev dependencies for build)
# Use --legacy-peer-deps to resolve chart.js version conflict
# Explicitly set NODE_ENV to development to ensure dev dependencies are installed
# (npm ci skips dev dependencies if NODE_ENV=production)
# Clean npm cache in same layer to reduce image size
# Verify critical packages are installed
RUN NODE_ENV=development npm ci --legacy-peer-deps && \
    npm cache clean --force && \
    echo "Installed packages: $(npm list --depth=0 2>/dev/null | wc -l)" && \
    (test -d node_modules/@sveltejs/kit || (echo "ERROR: @sveltejs/kit not installed" && ls -la node_modules/@sveltejs/ 2>&1 && exit 1)) && \
    (test -f node_modules/.bin/vite || (echo "ERROR: vite not found in node_modules/.bin" && exit 1)) && \
    (test -f node_modules/.bin/svelte-kit || (echo "ERROR: svelte-kit not found in node_modules/.bin" && exit 1)) && \
    echo "✓ Dependencies installed successfully"

# Copy source code (this layer will invalidate cache when code changes)
# Exclude node_modules and build artifacts via .dockerignore
COPY . .

# Generate SvelteKit configuration files before building
# This creates .svelte-kit/tsconfig.json and other required files
# Ensure the directory exists and has proper permissions
RUN npx svelte-kit sync && \
    (test -f .svelte-kit/tsconfig.json || (echo "ERROR: .svelte-kit/tsconfig.json not generated" && exit 1)) && \
    echo "✓ SvelteKit configuration generated"

# Build the application
# Use npx to ensure vite is found from node_modules
RUN npm run build

# Stage 2: Production stage
# Using latest Node.js 20 LTS with security patches (includes OpenSSL fixes)
FROM node:20.18-alpine AS production

# Build arguments
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=1.0.0

# Copy labels from builder stage
LABEL org.opencontainers.image.title="Wingspan Score Tracker" \
      org.opencontainers.image.description="SvelteKit application for tracking Wingspan game scores" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="Wingspan Score Tracker" \
      maintainer="Wingspan Score Tracker Team"

# Create app directory
WORKDIR /app

# Create non-root user for security (UID/GID 1001 is standard for Node.js)
# Combine user creation in single layer
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    mkdir -p /app/database && \
    chown -R nodejs:nodejs /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
# Note: better-sqlite3 requires native compilation, but we'll copy compiled modules from builder
# Using --legacy-peer-deps to resolve chart.js version conflict
# We need build tools temporarily to compile better-sqlite3 if it's not already compiled
# However, we copy the compiled module from builder, so this is a fallback
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ && \
    npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force && \
    apk del .build-deps && \
    rm -rf /var/cache/apk/*

# Copy compiled native modules from builder (better-sqlite3)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Copy built application from builder stage
# Combine COPY commands where possible to reduce layers
COPY --from=builder --chown=nodejs:nodejs /app/build ./build
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/static ./static

# Database directory already created above with proper permissions
# This directory will be used for volume mounting in docker-compose.prod.yml
# The volume mount (wingspan-db-prod:/app/database) will override this directory
# but the directory must exist in the image for the mount to work properly

# Copy database file from builder stage if it exists (for initial seed data)
# Volume mounting behavior:
# - If volume is empty on first mount: contents from image (including seeded DB) are copied to volume
# - If volume already has data: volume contents take precedence (persisted data is used)
# - If no volume is mounted: seeded database from image will be used (but won't persist)
# Using shell glob to handle case where file might not exist
RUN --mount=from=builder,source=/app/database,target=/tmp/db \
    sh -c 'if ls /tmp/db/*.db 1> /dev/null 2>&1; then cp /tmp/db/*.db /app/database/ && chown nodejs:nodejs /app/database/*.db; fi'

# Switch to non-root user
USER nodejs

# Expose port (default SvelteKit port, can be overridden)
EXPOSE 3000

# Set environment variables (consolidate to reduce layers)
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    ORIGIN=http://localhost:3000 \
    DATABASE_PATH=/app/database/wingspan.db \
    NODE_OPTIONS="--max-old-space-size=512"

# Health check with improved error handling
# Uses HTTP instead of HTTPS for internal health checks
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=40s \
            --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "build"]
