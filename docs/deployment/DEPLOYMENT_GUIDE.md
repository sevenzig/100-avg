# Production Deployment Guide

## 🚀 Deploying Code Changes to Production

### Overview
When deploying changes to production, you need to:
1. **Deploy code changes** (via Git push + Dokploy rebuild)
2. **Run database migrations** (if schema changed)
3. **Verify deployment** (check logs and functionality)

---

## Step 1: Deploy Code Changes

### Option A: Dokploy (Recommended)

1. **Push code to GitHub:**
   ```bash
   git push origin main
   ```

2. **In Dokploy Dashboard:**
   - Go to your application
   - Click **"Redeploy"** or **"Rebuild"**
   - Wait for build to complete (usually 2-5 minutes)

3. **Verify deployment:**
   - Check container status is "Running"
   - View logs for any errors

### Option B: Manual Docker Deployment

If using `docker-compose.prod.yml`:

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

---

## Step 2: Run Database Migrations

**⚠️ IMPORTANT:** If you added new database columns or tables, you MUST run migrations in production!

### For Profile Columns (display_name, platforms)

#### Option A: Via Dokploy Container

1. **SSH into your Dokploy server**
2. **Find your container:**
   ```bash
   docker ps | grep wingspan
   ```
   Note the container name (e.g., `dokploy-wingspan-score-1`)

3. **Run migration inside container:**
   ```bash
   docker exec -it <container-name> npm run migrate-profile
   ```

#### Option B: Via Dokploy UI

1. **In Dokploy Dashboard:**
   - Go to your application
   - Click **"Terminal"** or **"Execute Command"**
   - Run: `npm run migrate-profile`

#### Option C: Manual Database Copy (if needed)

If you need to run migration locally and copy database:

```bash
# Run migration locally
npm run migrate-profile

# Copy database to production container
docker cp ./database/wingspan.db <container-name>:/app/database/wingspan.db

# Restart container
docker restart <container-name>
```

### For Other Migrations

- **5-player support:** `npm run migrate`
- **Check database:** `npm run check-db`

---

## Step 3: Verify Deployment

### Check Application Status

1. **Visit your site:** `https://100avg.phelddagrif.farm`
2. **Check logs in Dokploy:**
   - Look for errors or warnings
   - Verify application started successfully

### Verify Database Schema

Run inside production container:
```bash
docker exec -it <container-name> npm run check-db
```

Or check via SQL:
```bash
docker exec -it <container-name> sqlite3 /app/database/wingspan.db "PRAGMA table_info(users);"
```

You should see:
- `display_name` column
- `platforms` column

### Test Functionality

1. **Login to the application**
2. **Go to Profile page**
3. **Try to edit profile:**
   - Change display name
   - Select platforms
   - Save changes
4. **Verify it works without errors**

---

## 🔧 Troubleshooting

### Code Changes Not Appearing

**Problem:** Code changes deployed but not visible

**Solutions:**
1. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check if build completed** in Dokploy logs
3. **Verify container restarted** after deployment
4. **Check for build errors** in Dokploy build logs

### Database Changes Not Working

**Problem:** New features require database columns that don't exist

**Solutions:**
1. **Run migration script:**
   ```bash
   docker exec -it <container-name> npm run migrate-profile
   ```

2. **Verify columns exist:**
   ```bash
   docker exec -it <container-name> sqlite3 /app/database/wingspan.db "PRAGMA table_info(users);"
   ```

3. **Check migration script ran successfully:**
   - Look for "✅ Migration verified" message
   - Check for any error messages

### 502 Bad Gateway

**Problem:** Application not responding

**Solutions:**
1. **Check container is running:**
   ```bash
   docker ps | grep wingspan
   ```

2. **Check application logs:**
   - In Dokploy: View Logs tab
   - Look for startup errors

3. **Verify port configuration:**
   - Port should be `3000` in Dokploy settings
   - Check environment variables are set

4. **Restart container:**
   - In Dokploy: Click Restart button

---

## 📋 Deployment Checklist

Before deploying:

- [ ] Code changes committed and pushed to GitHub
- [ ] All tests passing locally
- [ ] Database migration script created (if schema changed)
- [ ] Migration script tested locally
- [ ] Environment variables verified in Dokploy

After deploying:

- [ ] Code deployed successfully (Dokploy shows "Running")
- [ ] Database migration run (if needed)
- [ ] Application accessible at production URL
- [ ] New features tested and working
- [ ] No errors in application logs

---

## 🔄 Common Deployment Scenarios

### Scenario 1: Code Changes Only (No DB Changes)

```bash
# 1. Push code
git push origin main

# 2. In Dokploy: Click "Redeploy"
# 3. Wait for build
# 4. Test application
```

### Scenario 2: Code + Database Schema Changes

```bash
# 1. Push code
git push origin main

# 2. In Dokploy: Click "Redeploy"
# 3. Wait for build

# 4. Run migration
docker exec -it <container-name> npm run migrate-profile

# 5. Verify migration
docker exec -it <container-name> npm run check-db

# 6. Test application
```

### Scenario 3: Database Changes Only

```bash
# 1. Run migration locally first to test
npm run migrate-profile

# 2. Run migration in production
docker exec -it <container-name> npm run migrate-profile

# 3. Verify
docker exec -it <container-name> npm run check-db
```

---

## 📝 Notes

- **Always test migrations locally first** before running in production
- **Backup database** before running migrations (if possible)
- **Check logs** after deployment to catch errors early
- **Database migrations are safe** - they check if columns exist before adding

---

## 🆘 Need Help?

If deployment fails:

1. Check Dokploy logs for errors
2. Verify environment variables are set
3. Ensure database volume is mounted correctly
4. Check container resource limits (CPU/memory)
5. Review `DOKPLOY_TROUBLESHOOTING.md` for common issues
