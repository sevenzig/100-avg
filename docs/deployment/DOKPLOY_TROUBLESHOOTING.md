# Dokploy Troubleshooting Guide

**Platform**: Dokploy  
**Domain**: `100avg.phelddagrif.farm`  
**Issues**: 502 Bad Gateway + Let's Encrypt DNS Error

## 🔍 Understanding Dokploy

Dokploy is a self-hosted deployment platform that:
- Manages Docker containers automatically
- Handles reverse proxying (Traefik)
- Manages SSL certificates (Let's Encrypt)
- Provides web UI for deployments

## 🚨 Issue 1: 502 Bad Gateway

### Root Cause
Dokploy's reverse proxy (Traefik) cannot reach your application container.

### Solution Steps

1. **Check Application Status in Dokploy UI:**
   - Log into Dokploy dashboard
   - Navigate to your application
   - Check if container is running (should show "Running" status)
   - Check recent logs for errors

2. **Verify Port Configuration:**
   - In Dokploy app settings, ensure **Port** is set to `3000`
   - This should match your `docker-compose.prod.yml` PORT setting

3. **Check Environment Variables:**
   - Verify `JWT_SECRET` is set in Dokploy environment variables
   - Verify `DATABASE_PATH=/app/database/wingspan.db`
   - Verify `NODE_ENV=production`
   - Verify `PORT=3000`

4. **Check Container Logs:**
   ```bash
   # Via Dokploy UI: View Logs
   # Or via SSH to server:
   docker logs <dokploy-container-name>
   ```

5. **Verify Application is Listening:**
   - Container should be listening on port 3000 inside the container
   - Dokploy/Traefik will proxy external traffic to this port

## 🚨 Issue 2: Let's Encrypt DNS Error

### Root Cause
Dokploy tries to use Let's Encrypt, but your domain is on Tailscale (private network).

### Solution: Disable Let's Encrypt for Private Domains

**Option 1: Use Self-Signed Certificate in Dokploy**

1. **In Dokploy UI:**
   - Go to your application settings
   - Find SSL/TLS configuration
   - **Disable** "Automatic HTTPS" or "Let's Encrypt"
   - Enable "Self-Signed Certificate" or "Internal Certificate"

2. **Or Configure Custom Certificate:**
   - Generate Tailscale certificate:
     ```bash
     tailscale cert 100avg.phelddagrif.farm
     ```
   - In Dokploy, upload the certificate files:
     - Certificate: `/var/lib/tailscale/cert/100avg.phelddagrif.farm.crt`
     - Private Key: `/var/lib/tailscale/cert/100avg.phelddagrif.farm.key`

**Option 2: Configure Dokploy to Skip SSL Validation**

If Dokploy allows, you can:
- Set domain as "internal only"
- Disable SSL requirement
- Use HTTP only (not recommended for production)

**Option 3: Use Tailscale HTTPS Directly**

If Dokploy doesn't support custom certificates well:
1. Disable SSL in Dokploy
2. Run Tailscale HTTPS on the host:
   ```bash
   tailscale cert 100avg.phelddagrif.farm
   ```
3. Configure a separate reverse proxy (Caddy/Nginx) in front of Dokploy

## 🔧 Dokploy-Specific Configuration

### Application Settings in Dokploy

**Port Configuration:**
```
Container Port: 3000
Protocol: HTTP
```

**Environment Variables:**
```env
NODE_ENV=production
DATABASE_PATH=/app/database/wingspan.db
JWT_SECRET=<your-secret>
PORT=3000
```

**Volume Mounts:**
```
/app/database → Persistent volume for SQLite
```

**Health Check:**
```
Path: /
Port: 3000
Interval: 30s
```

### Docker Compose in Dokploy

If Dokploy uses your `docker-compose.prod.yml`, ensure:

1. **Port mapping is correct:**
   ```yaml
   ports:
     - "3000:3000"  # Dokploy will handle external routing
   ```

2. **Network configuration:**
   - Dokploy typically uses its own network
   - Ensure your app is on the correct network

3. **Health checks:**
   ```yaml
   healthcheck:
     test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
     interval: 30s
   ```

## 📋 Step-by-Step Fix

### Step 1: Fix 502 Error

1. **Access Dokploy Dashboard**
2. **Navigate to your application**
3. **Check Status:**
   - Container should be "Running"
   - If "Stopped" or "Error", check logs
4. **Verify Port:**
   - Settings → Port: Should be `3000`
5. **Check Environment Variables:**
   - All required vars should be set
6. **Restart Application:**
   - Click "Restart" in Dokploy UI
   - Wait 30 seconds
   - Check if 502 is resolved

### Step 2: Fix Let's Encrypt Error

1. **In Dokploy UI:**
   - Go to Application → Settings → SSL/TLS
2. **Disable Let's Encrypt:**
   - Turn off "Automatic HTTPS"
   - Or set domain as "Internal"
3. **Use Alternative:**
   - Enable "Self-Signed Certificate"
   - Or upload Tailscale certificate
4. **Save and Restart**

## 🔍 Diagnostic Commands (SSH to Server)

If you have SSH access to the Dokploy server:

```bash
# Check Dokploy containers
docker ps | grep dokploy

# Check your application container
docker ps | grep wingspan

# Check Traefik (Dokploy's reverse proxy)
docker ps | grep traefik

# View application logs
docker logs <your-app-container>

# Check if port 3000 is listening
docker exec <your-app-container> netstat -tuln | grep 3000

# Test backend directly
curl http://localhost:3000
```

## 🎯 Common Dokploy Issues

### Issue: Container keeps restarting
**Cause**: Application error or missing environment variables  
**Fix**: Check logs in Dokploy UI, verify all env vars are set

### Issue: Port conflict
**Cause**: Another service using port 3000  
**Fix**: Change port in Dokploy settings or stop conflicting service

### Issue: Database permissions
**Cause**: SQLite file permissions in Docker volume  
**Fix**: Ensure volume is writable, check Dokploy volume settings

### Issue: SSL certificate errors
**Cause**: Let's Encrypt can't validate private domain  
**Fix**: Disable Let's Encrypt, use self-signed or Tailscale certs

## 📝 Recommended Dokploy Configuration

### Application Settings:
```
Name: wingspan-score
Port: 3000
Protocol: HTTP
Domain: 100avg.phelddagrif.farm
SSL: Self-Signed (or Tailscale certificate)
```

### Environment Variables:
```
NODE_ENV=production
DATABASE_PATH=/app/database/wingspan.db
JWT_SECRET=<secure-random-secret>
PORT=3000
```

### Volumes:
```
/app/database → dokploy-wingspan-db (persistent)
```

### Health Check:
```
Enabled: Yes
Path: /
Port: 3000
Interval: 30s
Timeout: 3s
```

## 🚀 Quick Fix Summary

1. **For 502 Error:**
   - Check container is running in Dokploy UI
   - Verify port is 3000
   - Check environment variables
   - Restart application

2. **For Let's Encrypt Error:**
   - Disable "Automatic HTTPS" in Dokploy
   - Enable "Self-Signed Certificate"
   - Or configure Tailscale HTTPS manually

3. **Verify Fix:**
   - Wait 1-2 minutes after changes
   - Test: `curl https://100avg.phelddagrif.farm/`
   - Should return HTTP 200 (not 502)

---

**Next Steps**: Log into Dokploy dashboard and check your application settings, then apply the fixes above.
