# 502 Bad Gateway - Quick Fix Guide

**Domain**: `https://100avg.phelddagrif.farm/`  
**Error**: HTTP 502 Bad Gateway  
**Root Cause**: Reverse proxy cannot reach backend application

## 🚨 Quick Fix Checklist

Run these commands **on the server** hosting the application:

### Step 1: Check if Backend is Running

```powershell
# Check Docker containers
docker ps

# Check specific container
docker ps | Select-String "100avg|phelddagrif"

# If using docker-compose
docker-compose ps
```

**Expected**: Container should show status "Up" or "running"

### Step 2: Check Container Logs

```powershell
# View recent logs
docker logs <container-name> --tail 50

# Follow logs in real-time
docker logs -f <container-name>
```

**Look for**:
- Application startup messages
- Port binding confirmation
- Error messages
- Database connection issues

### Step 3: Verify Port is Listening

```powershell
# Check if port 3000 is listening
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

# Or check inside container
docker exec <container-name> netstat -tuln | Select-String "3000"
```

**Expected**: Should show port 3000 in LISTEN state

### Step 4: Test Backend Directly

```powershell
# Test from host (bypass proxy)
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing

# Test from inside container
docker exec <container-name> curl http://localhost:3000
```

**Expected**: Should return HTTP 200 or application response

### Step 5: Restart Service

```powershell
# Docker Compose
docker-compose restart

# Or specific container
docker restart <container-name>

# Wait a few seconds, then test
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri "https://100avg.phelddagrif.farm/" -UseBasicParsing
```

## 🔧 Common Fixes

### Fix 1: Container Not Running
```powershell
# Start the container
docker-compose up -d

# Or
docker start <container-name>
```

### Fix 2: Container Crashed
```powershell
# Check why it stopped
docker logs <container-name>

# Common issues:
# - Missing environment variables (JWT_SECRET, DATABASE_PATH)
# - Port already in use
# - Database file permissions
# - Application errors
```

### Fix 3: Wrong Port Configuration
```powershell
# Check what port the app is actually using
docker logs <container-name> | Select-String "listening|port|3000|5173"

# Verify docker-compose port mapping
Get-Content docker-compose.yml | Select-String "ports"
```

### Fix 4: Reverse Proxy Misconfiguration
```powershell
# If using nginx, check config
nginx -t

# Check upstream configuration points to correct port
Get-Content /etc/nginx/sites-enabled/* | Select-String "100avg|3000|upstream"
```

### Fix 5: Network/Firewall Issue
```powershell
# Check if container can reach host
docker exec <container-name> ping -c 1 host.docker.internal

# Check firewall rules
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*3000*"}
```

## 📋 Diagnostic Script

Run the comprehensive diagnostic script:

```powershell
.\502_DIAGNOSTIC_SCRIPT.ps1
```

This will automatically check:
- DNS resolution
- HTTPS connectivity
- Docker container status
- Listening ports
- Backend direct access
- Reverse proxy configuration
- System resources

## 🎯 Most Likely Solutions (in order)

1. **Container stopped/crashed** → Restart it
2. **Application error** → Check logs, fix error, restart
3. **Port mismatch** → Verify proxy upstream matches app port
4. **Environment variables missing** → Set required env vars
5. **Database issues** → Check database file permissions/path

## 📞 Next Steps

1. **SSH into the server** hosting `100avg.phelddagrif.farm`
2. **Run the diagnostic script**: `.\502_DIAGNOSTIC_SCRIPT.ps1`
3. **Check container logs**: `docker logs <container-name>`
4. **Verify port binding**: Container should listen on port 3000
5. **Test backend directly**: `curl http://localhost:3000`

## 🔍 What to Look For

### In Container Logs:
```
✓ "Server listening on port 3000"
✓ "Database initialized"
✓ "Application started"
✗ "Error: Cannot bind to port"
✗ "Error: Database connection failed"
✗ "Error: Missing environment variable"
```

### In Reverse Proxy Logs:
```
✗ "connect() failed (111: Connection refused)"
✗ "upstream timed out"
✗ "no live upstreams"
```

---

**Quick Test**: After applying fixes, test with:
```powershell
Invoke-WebRequest -Uri "https://100avg.phelddagrif.farm/" -UseBasicParsing
```

Expected: HTTP 200 status code instead of 502
