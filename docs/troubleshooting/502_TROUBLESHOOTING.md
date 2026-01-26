# 502 Bad Gateway Troubleshooting Guide

**Domain**: `https://100avg.phelddagrif.farm/`  
**Error**: HTTP/2 502 Bad Gateway  
**IP Address**: 100.4.197.204 (Tailscale network)

## 🔍 Root Cause Analysis

A **502 Bad Gateway** error indicates that:
- The reverse proxy/load balancer (nginx, Caddy, Cloudflare, etc.) is working
- The proxy **cannot reach** the backend application server
- The backend server is either:
  - Not running
  - Not listening on the expected port
  - Blocked by firewall
  - Misconfigured
  - Crashed or unresponsive

## 📊 Diagnostic Information

### DNS Resolution
- ✅ Domain resolves: `100avg.phelddagrif.farm` → `100.4.197.204`
- ✅ IP is Tailscale address (100.x.x.x range)
- ✅ HTTPS connection established (SSL/TLS working)

### Connection Status
- ❌ Backend service not responding (502 error)
- ⚠️ Reverse proxy is reachable but backend is not

## 🔧 Troubleshooting Steps

### 1. Check Backend Service Status

**If using Docker:**
```bash
# Check if container is running
docker ps | grep 100avg

# Check container logs
docker logs <container-name>

# Check if service is listening
docker exec <container-name> netstat -tuln | grep 3000
```

**If using systemd:**
```bash
# Check service status
systemctl status <service-name>

# View service logs
journalctl -u <service-name> -n 50
```

### 2. Verify Backend Port Configuration

The backend should be listening on the port configured in your reverse proxy:

```bash
# Check what's listening on common ports
netstat -tuln | grep -E ':(3000|5173|8080|8000)'

# Or using ss
ss -tuln | grep -E ':(3000|5173|8080|8000)'
```

### 3. Check Reverse Proxy Configuration

**For Nginx:**
```bash
# Check nginx config
sudo nginx -t

# View nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check upstream configuration
grep -r "100avg\|phelddagrif" /etc/nginx/
```

**For Caddy:**
```bash
# Check Caddy config
caddy validate --config /path/to/Caddyfile

# View Caddy logs
journalctl -u caddy -n 50
```

### 4. Verify Network Connectivity

```bash
# Test if backend is reachable from proxy server
curl http://localhost:3000
curl http://127.0.0.1:3000

# Test from proxy to backend (if different hosts)
curl http://<backend-ip>:3000
```

### 5. Check Firewall Rules

```bash
# Check if port is open
sudo ufw status
sudo firewall-cmd --list-all

# Check iptables
sudo iptables -L -n
```

### 6. Verify Application Health

**If using Docker Compose:**
```bash
# Check service health
docker-compose ps

# Check health status
docker inspect <container> | grep -A 10 Health
```

## 🎯 Common Solutions

### Solution 1: Restart Backend Service

```bash
# Docker
docker-compose restart

# Systemd
sudo systemctl restart <service-name>
```

### Solution 2: Check Port Binding

Ensure the application is binding to `0.0.0.0` not `127.0.0.1`:

```javascript
// ❌ Wrong - only accessible locally
app.listen(3000, '127.0.0.1')

// ✅ Correct - accessible from network
app.listen(3000, '0.0.0.0')
```

### Solution 3: Verify Reverse Proxy Upstream

**Nginx example:**
```nginx
upstream backend {
    server 127.0.0.1:3000;
    # or server <container-ip>:3000;
}

server {
    server_name 100avg.phelddagrif.farm;
    
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Caddy example:**
```caddy
100avg.phelddagrif.farm {
    reverse_proxy localhost:3000
    # or reverse_proxy <container-ip>:3000
}
```

### Solution 4: Check Container Networking

If using Docker, ensure:
- Container is on the correct network
- Port mapping is correct
- Container can reach host network if needed

```bash
# Check container network
docker network inspect <network-name>

# Verify port mapping
docker port <container-name>
```

### Solution 5: Verify Environment Variables

Check that required environment variables are set:
- `PORT` (should match reverse proxy upstream)
- `NODE_ENV`
- `DATABASE_PATH`
- `JWT_SECRET`

## 🔍 Advanced Diagnostics

### Check Application Logs

```bash
# Docker logs
docker logs -f <container-name>

# Application logs
tail -f /var/log/app/error.log
```

### Test Backend Directly

```bash
# Bypass reverse proxy
curl http://<server-ip>:3000

# Test health endpoint
curl http://<server-ip>:3000/health
```

### Network Tracing

```bash
# Check if proxy can reach backend
traceroute <backend-ip>

# Check DNS resolution
dig 100avg.phelddagrif.farm
```

## 📝 Checklist

- [ ] Backend service is running
- [ ] Backend is listening on correct port
- [ ] Backend is bound to `0.0.0.0` not `127.0.0.1`
- [ ] Reverse proxy upstream points to correct address
- [ ] Firewall allows traffic on backend port
- [ ] Network connectivity between proxy and backend
- [ ] Application logs show no errors
- [ ] Environment variables are correctly set
- [ ] Container networking is properly configured (if using Docker)

## 🚨 Immediate Actions

1. **Check if backend is running:**
   ```bash
   docker ps  # or systemctl status
   ```

2. **View recent logs:**
   ```bash
   docker logs --tail 50 <container>  # or journalctl -n 50
   ```

3. **Restart the service:**
   ```bash
   docker-compose restart  # or systemctl restart
   ```

4. **Test backend directly:**
   ```bash
   curl http://localhost:3000
   ```

## 📚 Related Documentation

- [Nginx 502 Bad Gateway Troubleshooting](https://www.nginx.com/resources/wiki/start/topics/tutorials/config_pitfalls/#proxy-pass)
- [Docker Networking Guide](https://docs.docker.com/network/)
- [Tailscale Documentation](https://tailscale.com/kb/)

---

**Next Steps**: Run the diagnostic commands above on the server hosting `100avg.phelddagrif.farm` to identify the specific issue.
