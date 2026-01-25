# Quick Fix: Let's Encrypt DNS Error

## Problem
```
queryA ENOTFOUND 100avg.phelddagrif.farm
```

Let's Encrypt cannot resolve your domain because it's on a private Tailscale network.

## Quick Solution (Choose One)

### Option 1: Use Tailscale HTTPS (Recommended)

```bash
# Enable Tailscale HTTPS
tailscale cert 100avg.phelddagrif.farm

# Update Caddyfile
100avg.phelddagrif.farm {
    tls /var/lib/tailscale/cert/100avg.phelddagrif.farm.crt /var/lib/tailscale/cert/100avg.phelddagrif.farm.key
    reverse_proxy localhost:3000
}

# Reload Caddy
sudo systemctl reload caddy
```

### Option 2: Use Self-Signed Certificate

**For Caddy:**
```caddy
100avg.phelddagrif.farm {
    tls internal
    reverse_proxy localhost:3000
}
```

**For Nginx:**
```bash
# Generate certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/100avg.key \
  -out /etc/nginx/ssl/100avg.crt \
  -subj "/CN=100avg.phelddagrif.farm"

# Update nginx config
server {
    listen 443 ssl;
    server_name 100avg.phelddagrif.farm;
    ssl_certificate /etc/nginx/ssl/100avg.crt;
    ssl_certificate_key /etc/nginx/ssl/100avg.key;
    location / {
        proxy_pass http://localhost:3000;
    }
}

# Reload
sudo nginx -t && sudo systemctl reload nginx
```

## Why This Happens

- Your domain uses Tailscale IP (100.4.197.204)
- Let's Encrypt needs public DNS resolution
- Private networks can't use Let's Encrypt validation

## Result

✅ HTTPS will work on your Tailscale network  
✅ No more Let's Encrypt errors  
✅ Certificates will work for Tailscale clients
