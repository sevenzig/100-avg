# Dokploy Database Configuration Guide

## Problem
The database file was being committed to Git, causing Dokploy to pull stale database data on each deployment. The database should use a persistent volume instead.

## Solution

### Step 1: Database is Now Excluded from Git ✅
- Database files are now properly ignored in `.gitignore`
- Database file removed from git tracking
- `.dockerignore` updated to exclude database from Docker images

### Step 2: Configure Dokploy Persistent Volume

In your Dokploy dashboard, ensure the following:

#### Volume Mount Configuration
1. **Go to**: Application → Settings → Volumes
2. **Add Volume Mount**:
   - **Container Path**: `/app/database`
   - **Volume Type**: `Persistent Volume` (or `Named Volume`)
   - **Volume Name**: `wingspan-db-prod` (or any name you prefer)
   - **Access Mode**: `Read/Write`

#### Environment Variables
Ensure these are set in Dokploy:
```env
DATABASE_PATH=/app/database/wingspan.db
NODE_ENV=production
JWT_SECRET=<your-secret>
PORT=3000
```

### Step 3: Verify Database Persistence

After configuring the volume:

1. **Deploy/Redeploy** your application in Dokploy
2. **Check Logs** - You should see database initialization messages
3. **Test the Application** - Create some data
4. **Restart the Container** - Data should persist

### Step 4: Initial Database Setup (If Needed)

If you need to seed the database with initial data:

**Option A: Use the seed script (if available)**
```bash
# In Dokploy, execute in container:
npm run seed
```

**Option B: Copy database manually**
1. Export your local database
2. Copy it to the Dokploy volume
3. Restart the container

### Troubleshooting

#### Database Not Persisting
- **Check Volume Mount**: Ensure `/app/database` is mounted as a persistent volume
- **Check Permissions**: Database directory must be writable (user `nodejs` or `1001`)
- **Check Logs**: Look for database initialization errors

#### Database Not Found After Deploy
- The database will be **auto-created** on first run if it doesn't exist
- Check application logs for database initialization messages
- Verify `DATABASE_PATH` environment variable is set correctly

#### Old Data Still Showing
- **Clear the volume** in Dokploy (if you want to start fresh)
- **Or** manually delete the database file in the volume
- The application will recreate it on next start

### Important Notes

1. **Never commit database files to Git** - They're now properly excluded
2. **Always use persistent volumes** - Never mount database from git
3. **Backup regularly** - Use Dokploy's volume backup feature or export manually
4. **Database auto-initializes** - The app creates the schema on first run

## Verification Checklist

- [ ] Database file removed from git (check `git status`)
- [ ] `.gitignore` excludes `database/*.db`
- [ ] `.dockerignore` excludes `database/*.db`
- [ ] Dokploy volume mounted at `/app/database`
- [ ] `DATABASE_PATH` environment variable set
- [ ] Application creates database on first run
- [ ] Data persists after container restart

---

**After these changes, commit and push:**
```bash
git add .gitignore .dockerignore
git commit -m "fix: exclude database from git and docker builds"
git push
```

Then redeploy in Dokploy - it will use the persistent volume instead of the git-tracked database file.
