# Upload Timeout Fix - Quick Reference

## Problem
Screenshot uploads fail with timeout error after ~4-5 seconds:
```json
{"success":false,"error":"Request timed out. The image processing is taking too long. Please try again."}
```

## Root Cause
Dokploy's reverse proxy (Traefik) has a default timeout of ~5 seconds. Image processing with Claude API takes 10-30+ seconds, exceeding this timeout.

## Solution: Increase Traefik Timeout in Dokploy

### Step 1: Access Dokploy Dashboard
1. Log into your Dokploy instance
2. Navigate to your application (wingspan-score)

### Step 2: Configure Timeout

**Option A: Via Dokploy UI (Easiest)**
1. Go to **Settings** → **Advanced** or **Proxy Settings**
2. Look for **"Request Timeout"**, **"Proxy Timeout"**, or **"Response Timeout"**
3. Set to **90 seconds** (or higher)
4. Save and restart the application

**Option B: Via Docker Compose Labels**
If Dokploy allows custom labels, add to `docker-compose.prod.yml`:

```yaml
services:
  app:
    labels:
      - "traefik.http.middlewares.upload-timeout.forwardauth.address=http://localhost:3000"
      - "traefik.http.middlewares.upload-timeout.headers.customRequestHeaders.X-Forwarded-Timeout=90s"
      - "traefik.http.routers.app.middlewares=upload-timeout"
```

**Option C: Via Environment Variable**
Add to application environment variables in Dokploy:
```
TRAEFIK_TIMEOUT=90s
```
or
```
PROXY_TIMEOUT=90
```

### Step 3: Verify Fix

1. **Check logs in Dokploy:**
   - Upload a screenshot
   - Check application logs for timing information
   - Should see: `[Upload] Upload completed successfully in Xms`

2. **Test the endpoint:**
   ```bash
   curl -X POST https://100avg.phelddagrif.farm/api/games/upload-screenshot \
     -F "image=@test-image.png" \
     -F "leagueId=1" \
     --max-time 120
   ```

3. **Expected behavior:**
   - Request completes successfully (no timeout)
   - Processing time visible in logs (typically 10-30 seconds)
   - Returns extracted game data

## Current Timeout Configuration

- **Client timeout:** 60 seconds (browser)
- **Claude API timeout:** 60 seconds (server-side)
- **Traefik timeout:** ~5 seconds (needs to be increased to 90s)

## If Timeout Setting Not Available

If Dokploy doesn't expose timeout settings in the UI:

1. **Check Dokploy version:**
   - Newer versions may have timeout settings
   - Consider updating Dokploy if possible

2. **Use SSH access (if available):**
   - Access the Dokploy server
   - Configure Traefik directly (see `DOKPLOY_TROUBLESHOOTING.md`)

3. **Alternative: Use background processing:**
   - Implement async job queue (Redis/Bull)
   - Return job ID immediately
   - Poll for completion status
   - This requires code changes

## Monitoring

After applying the fix, monitor:
- Application logs for processing times
- Traefik logs for timeout errors
- User reports of successful uploads

## Related Documentation

- Full troubleshooting guide: `docs/deployment/DOKPLOY_TROUBLESHOOTING.md`
- Network error troubleshooting: `UPLOAD_NETWORK_ERROR_TROUBLESHOOTING.md`
