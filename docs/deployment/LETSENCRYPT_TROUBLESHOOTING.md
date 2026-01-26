# Let's Encrypt DNS Resolution Error

**Error**: `queryA ENOTFOUND 100avg.phelddagrif.farm`  
**Context**: Let's Encrypt certificate validation/renewal  
**Issue**: Let's Encrypt cannot resolve the domain via public DNS

## 🔍 Root Cause

The domain `100avg.phelddagrif.farm` resolves to a **Tailscale private IP** (`100.4.197.204`), which is:
- ✅ Accessible on your Tailscale network
- ❌ **Not accessible** via public DNS
- ❌ **Not resolvable** by Let's Encrypt's validation servers

Let's Encrypt requires **public DNS resolution** to validate domain ownership and issue certificates.

## 🎯 Solutions

### Solution 1: Use Tailscale HTTPS with Self-Signed Certificate (Recommended for Private Networks)

Since this is a private Tailscale network, use a self-signed certificate:

**For Caddy:**
```caddy
100avg.phelddagrif.farm {
    tls internal
    reverse_proxy localhost:3000
}
```

**For Nginx:**
```nginx
server {
    listen 443 ssl;
    server_name 100avg.phelddagrif.farm;
    
    # Self-signed certificate (generate once)
    ssl_certificate /path/to/self-signed.crt;
    ssl_certificate_key /path/to/self-signed.key;
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

**Generate self-signed certificate:**
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /path/to/self-signed.key \
  -out /path/to/self-signed.crt \
  -subj "/CN=100avg.phelddagrif.farm"
```

### Solution 2: Use Tailscale HTTPS (Built-in)

Tailscale provides built-in HTTPS with automatic certificates:

```bash
# Enable Tailscale HTTPS
tailscale cert 100avg.phelddagrif.farm

# This generates certificates in:
# /var/lib/tailscale/cert/100avg.phelddagrif.farm.crt
# /var/lib/tailscale/cert/100avg.phelddagrif.farm.key
```

**Configure Caddy/Nginx to use Tailscale certificates:**
```caddy
100avg.phelddagrif.farm {
    tls /var/lib/tailscale/cert/100avg.phelddagrif.farm.crt /var/lib/tailscale/cert/100avg.phelddagrif.farm.key
    reverse_proxy localhost:3000
}
```

### Solution 3: Set Up Public DNS (If Domain Should Be Public)

If you want Let's Encrypt to work, you need public DNS:

1. **Add public DNS record** pointing to a public IP:
   ```
   Type: A
   Name: 100avg
   Value: <your-public-ip>
   TTL: 300
   ```

2. **Ensure port 80/443 are publicly accessible**

3. **Then Let's Encrypt will work:**
   ```caddy
   100avg.phelddagrif.farm {
       reverse_proxy localhost:3000
   }
   ```

### Solution 4: Use DNS-01 Challenge (Advanced)

If you control the DNS provider, use DNS-01 challenge:

**For Caddy with DNS challenge:**
```caddy
100avg.phelddagrif.farm {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy localhost:3000
}
```

## 🔧 Immediate Fix

### For Caddy (Most Common)

1. **Check current Caddyfile:**
   ```bash
   cat /etc/caddy/Caddyfile | grep -A 5 "100avg"
   ```

2. **Update to use Tailscale certs or self-signed:**
   ```caddy
   # Option A: Tailscale HTTPS
   100avg.phelddagrif.farm {
       tls /var/lib/tailscale/cert/100avg.phelddagrif.farm.crt /var/lib/tailscale/cert/100avg.phelddagrif.farm.key
       reverse_proxy localhost:3000
   }
   
   # Option B: Self-signed
   100avg.phelddagrif.farm {
       tls internal
       reverse_proxy localhost:3000
   }
   ```

3. **Reload Caddy:**
   ```bash
   sudo systemctl reload caddy
   # or
   caddy reload --config /etc/caddy/Caddyfile
   ```

### For Nginx

1. **Generate self-signed certificate:**
   ```bash
   sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout /etc/nginx/ssl/100avg.phelddagrif.farm.key \
     -out /etc/nginx/ssl/100avg.phelddagrif.farm.crt \
     -subj "/CN=100avg.phelddagrif.farm"
   ```

2. **Update Nginx config:**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name 100avg.phelddagrif.farm;
       
       ssl_certificate /etc/nginx/ssl/100avg.phelddagrif.farm.crt;
       ssl_certificate_key /etc/nginx/ssl/100avg.phelddagrif.farm.key;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. **Test and reload:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## 📋 Diagnostic Steps

### 1. Check Current Certificate Status
```bash
# Check certificate expiration
openssl s_client -connect 100avg.phelddagrif.farm:443 -servername 100avg.phelddagrif.farm < /dev/null 2>/dev/null | openssl x509 -noout -dates

# Check what certificates Caddy is using
caddy list-certificates
```

### 2. Check DNS Resolution
```bash
# From your machine (Tailscale network)
nslookup 100avg.phelddagrif.farm

# From public DNS (should fail)
dig @8.8.8.8 100avg.phelddagrif.farm
```

### 3. Check Reverse Proxy Logs
```bash
# Caddy logs
journalctl -u caddy -n 50 | grep -i "cert\|tls\|letsencrypt"

# Nginx logs
sudo tail -f /var/log/nginx/error.log | grep -i "cert\|ssl"
```

## 🚨 Common Errors and Fixes

### Error: "queryA ENOTFOUND"
**Cause**: Let's Encrypt can't resolve domain  
**Fix**: Use Tailscale HTTPS or self-signed certificate (Solution 1 or 2)

### Error: "Certificate expired"
**Cause**: Let's Encrypt cert expired and can't renew  
**Fix**: Switch to Tailscale HTTPS or self-signed certificate

### Error: "Connection refused" during validation
**Cause**: Let's Encrypt can't reach your server  
**Fix**: Use DNS-01 challenge or switch to private certificate

## ✅ Recommended Approach for Tailscale Networks

**Best Practice**: Use **Tailscale HTTPS** (Solution 2)

```bash
# 1. Enable Tailscale HTTPS
tailscale cert 100avg.phelddagrif.farm

# 2. Update Caddyfile
100avg.phelddagrif.farm {
    tls /var/lib/tailscale/cert/100avg.phelddagrif.farm.crt /var/lib/tailscale/cert/100avg.phelddagrif.farm.key
    reverse_proxy localhost:3000
}

# 3. Reload
sudo systemctl reload caddy
```

**Benefits**:
- ✅ Automatic certificate management
- ✅ Works on private networks
- ✅ No public DNS required
- ✅ Certificates auto-renew
- ✅ Trusted by Tailscale clients

## 📚 Additional Resources

- [Tailscale HTTPS Documentation](https://tailscale.com/kb/1153/enabling-https/)
- [Caddy TLS Configuration](https://caddyserver.com/docs/automatic-https)
- [Let's Encrypt DNS Challenges](https://letsencrypt.org/docs/challenge-types/)

---

**Quick Fix**: If you're using Caddy, add `tls internal` to your Caddyfile block for this domain to use a self-signed certificate that works on your private network.
