# Code Improvements

## Error Handling & Logging

- Replace 47+ `console.error/console.log` calls with structured logging (Winston/Pino)
- Add error context (request ID, user ID, timestamp) to all error logs
- Implement error boundaries in Svelte components
- Standardize error response format across all API endpoints
- Add request ID tracking for debugging

## Type Safety

- Remove `any` types (5 instances found)
- Add strict type definitions for database row types
- Type all API request/response bodies explicitly
- Add type guards for runtime validation
- Use branded types for IDs (UserId, LeagueId, GameId)

## Database

- Refactor migration logic in `db.ts` (lines 112-186) - use proper migration system
- Add database connection pooling for production
- Add transaction support for multi-step operations
- Create migration scripts instead of inline ALTER TABLE
- Add database backup/restore utilities
- Add query result caching for stats endpoints

## Security

- Rate limiter uses in-memory Map - won't work in multi-instance deployments (use Redis)
- Add CSRF token validation for state-changing operations
- Implement JWT refresh token mechanism
- Add input sanitization for all user-provided strings
- Add rate limiting to all API endpoints, not just auth
- Validate file uploads server-side (magic number checks)
- Add request size limits to prevent DoS

## Code Organization

- Extract duplicate `getUserId` function (found in multiple files)
- Create shared error handling utilities
- Extract validation logic into reusable functions
- Create API response wrapper utilities
- Organize types into domain-specific files
- Add barrel exports for cleaner imports

## Performance

- Add database query result caching (stats calculations)
- Implement pagination for all list endpoints
- Add database indexes for frequently queried columns
- Lazy load heavy components (charts, large tables)
- Optimize image parsing (stream processing, compression)
- Add response compression middleware

## Testing

- Add unit tests for utility functions (auth, validation, db)
- Add integration tests for API endpoints
- Add E2E tests for critical user flows
- Add type tests with TypeScript compiler checks
- Add performance benchmarks for stats calculations

## API Design

- Add API versioning (`/api/v1/...`)
- Standardize error response format
- Add request/response validation middleware
- Add API documentation (OpenAPI/Swagger)
- Add request/response logging middleware

## Frontend

- Replace `any` type in profile save handler
- Add loading states for all async operations
- Add error toast notifications
- Implement optimistic UI updates
- Add form validation feedback
- Add accessibility improvements (ARIA labels, keyboard navigation)

## Configuration

- Move hardcoded values to config (rate limits, timeouts, file sizes)
- Add environment-specific configs
- Add config validation on startup
- Document all environment variables

## Monitoring

- Add health check endpoint
- Add metrics collection (response times, error rates)
- Add structured logging for production
- Add error tracking (Sentry/LogRocket)

## Documentation

- Add JSDoc comments to all public functions
- Document API endpoints with examples
- Add architecture decision records (ADRs)
- Document deployment process

## Dependencies

- Update dependencies to latest stable versions
- Remove unused dependencies
- Add dependency vulnerability scanning
- Pin dependency versions for production

## Database Schema

- Add `updated_at` triggers for automatic timestamp updates
- Add soft delete support (deleted_at column)
- Add database constraints for business rules
- Add database-level validation where possible

## Code Quality

- Add ESLint with strict rules
- Add Prettier for code formatting
- Add pre-commit hooks (lint, format, type-check)
- Add code coverage reporting
- Enforce consistent naming conventions
