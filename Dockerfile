# Multi-stage Dockerfile for Wingspan Score Tracker
# Stage 1: Build stage
# Using latest Node.js 20 LTS with security patches (includes OpenSSL fixes)
FROM node:20.18-alpine AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock* ./

# Install dependencies (including dev dependencies for build)
# Using --legacy-peer-deps to resolve chart.js version conflict
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production stage
# Using latest Node.js 20 LTS with security patches (includes OpenSSL fixes)
FROM node:20.18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
# Note: better-sqlite3 requires native compilation, but we'll copy compiled modules from builder
# Using --legacy-peer-deps to resolve chart.js version conflict
RUN npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force

# Copy compiled native modules from builder (better-sqlite3)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/build ./build
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/static ./static

# Create database directory with proper permissions
# This directory will be used for volume mounting in docker-compose.prod.yml
# The volume mount (wingspan-db-prod:/app/database) will override this directory
# but the directory must exist in the image for the mount to work properly
RUN mkdir -p /app/database && \
    chown -R nodejs:nodejs /app/database

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

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV ORIGIN=http://localhost:3000
ENV DATABASE_PATH=/app/database/wingspan.db

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "build"]
