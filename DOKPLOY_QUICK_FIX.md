# Dokploy Quick Fix Guide

## Problem
- **502 Bad Gateway** on `https://100avg.phelddagrif.farm/`
- **Let's Encrypt error**: `queryA ENOTFOUND 100avg.phelddagrif.farm`

## Quick Fix (5 minutes)

### Step 1: Fix 502 Error

1. **Log into Dokploy Dashboard**
2. **Find your application** (wingspan-score)
3. **Check Status:**
   - Container should be "Running"
   - If not, check logs and restart
4. **Verify Settings:**
   - **Port**: Should be `3000`
   - **Environment Variables**: 
     - `JWT_SECRET` (required)
     - `DATABASE_PATH=/app/database/wingspan.db`
     - `NODE_ENV=production`
     - `PORT=3000`
5. **Restart Application** (click Restart button)

### Step 2: Fix Let's Encrypt Error

1. **In Dokploy UI:**
   - Go to: Application → Settings → SSL/TLS
2. **Disable Let's Encrypt:**
   - Turn OFF "Automatic HTTPS"
   - Or set domain as "Internal Only"
3. **Enable Self-Signed:**
   - Turn ON "Self-Signed Certificate"
   - Or "Use Internal Certificate"
4. **Save Settings**
5. **Restart Application**

### Step 3: Verify

Wait 1-2 minutes, then test:
```bash
curl https://100avg.phelddagrif.farm/
```

Should return HTTP 200 (not 502).

## If Still Not Working

### Check Container Logs in Dokploy:
- Click "Logs" tab in Dokploy UI
- Look for errors like:
  - "Cannot bind to port"
  - "Database connection failed"
  - "Missing environment variable"

### Common Issues:

**Container not starting:**
- Check environment variables are all set
- Check logs for startup errors

**Port already in use:**
- Change port in Dokploy settings
- Or stop conflicting service

**Database errors:**
- Check volume is mounted correctly
- Verify database directory permissions

---

**That's it!** The 502 should be fixed once the container is running, and the Let's Encrypt error is resolved by using self-signed certificates.
