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
RUN mkdir -p /app/database && \
    chown -R nodejs:nodejs /app/database

# Copy existing database (for initial seeding)
COPY --chown=nodejs:nodejs database/wingspan.db /app/database/wingspan.db

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
