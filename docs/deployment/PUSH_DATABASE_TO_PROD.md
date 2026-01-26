# Pushing Database to Production - Complete Guide

## The Problem

When you have a Docker volume mounted (`wingspan-db-prod:/app/database`), the volume's contents **always take precedence** over the database file in the Docker image. This means:

- ✅ The seeded database in the image is only used if the volume is **empty** on first mount
- ❌ If the volume already exists (even if empty), it won't use the seeded database
- ❌ Copying the database to a **running** container may fail due to file locks

## Solution: Stop Container, Copy Database, Restart

### For Dokploy (Your Setup)

#### Method 1: Via SSH (Recommended)

1. **SSH into your Dokploy server**

2. **Find your container:**
   ```bash
   docker ps | grep wingspan
   ```
   Note the container name (e.g., `wingspan-score-prod` or `dokploy-wingspan-xxx`)

3. **Stop the container:**
   ```bash
   docker stop <container-name>
   ```
   Or via Dokploy UI: Application → Stop

4. **Copy your local database to the server:**
   
   **Windows PowerShell (using OpenSSH - built into Windows 10/11):**
   ```powershell
   # From your project directory in PowerShell
   scp .\database\wingspan.db user@your-server:/tmp/wingspan.db
   
   # Or with full path
   scp C:\Users\scootypuffjr\Projects\wingspan-score\database\wingspan.db user@your-server:/tmp/wingspan.db
   ```
   
   **Alternative: Using PowerShell's Copy-Item with SSH (if scp not available):**
   ```powershell
   # If scp doesn't work, you can use WinSCP or manually upload via SFTP
   # Or use this PowerShell method (requires SSH module):
   $session = New-SSHSession -ComputerName your-server -Credential (Get-Credential)
   Set-SCPFile -ComputerName your-server -Credential (Get-Credential) -LocalFile .\database\wingspan.db -RemotePath /tmp/wingspan.db
   ```
   
   **Note:** Replace `user@your-server` with your actual username and server address, e.g.:
   ```powershell
   scp .\database\wingspan.db scott@100avg.phelddagrif.farm:/tmp/wingspan.db
   ```

5. **On the server, copy database to the bind mount directory:**
   ```bash
   # The database is stored at /home/scott/databases (bind mount)
   # Ensure directory exists and has correct permissions:
   sudo mkdir -p /home/scott/databases
   sudo chown -R 1001:1001 /home/scott/databases
   sudo chmod 755 /home/scott/databases
   
   # Copy database file
   sudo cp /tmp/wingspan.db /home/scott/databases/wingspan.db
   sudo chown 1001:1001 /home/scott/databases/wingspan.db
   sudo chmod 644 /home/scott/databases/wingspan.db
   
   # Alternative: Copy to stopped container (will go to bind mount on restart)
   docker cp /tmp/wingspan.db <container-name>:/app/database/wingspan.db
   ```

7. **Start the container:**
   ```bash
   docker start <container-name>
   ```
   Or via Dokploy UI: Application → Start

#### Method 2: Via Dokploy UI (If Available)

1. **Stop the application** in Dokploy UI

2. **Use Dokploy File Manager** (if available):
   - Navigate to `/app/database/`
   - Upload your `wingspan.db` file
   - Replace existing file

3. **Start the application** in Dokploy UI

#### Method 3: Copy to Running Container (Risky - May Fail)

⚠️ **Warning:** This may fail if SQLite has the database file locked.

```bash
# Find container
docker ps | grep wingspan

# Try to copy (may fail if database is locked)
docker cp ./database/wingspan.db <container-name>:/app/database/wingspan.db

# Restart to ensure it's loaded
docker restart <container-name>
```

### For Docker Compose (Local/Manual)

```bash
# 1. Stop the container
docker-compose -f docker-compose.prod.yml stop app

# 2. Copy database to container (will go to volume)
docker cp ./database/wingspan.db wingspan-score-prod:/app/database/wingspan.db

# 3. Start the container
docker-compose -f docker-compose.prod.yml start app
```

## Why You Need to Stop the Container

1. **File Locking**: SQLite locks the database file when the application is running
2. **Volume Mounting**: The volume is mounted when the container starts, so changes need the container stopped
3. **Data Integrity**: Stopping ensures no writes are happening during the copy

## Verification Steps

After pushing the database:

1. **Check container logs:**
   ```bash
   docker logs <container-name> | tail -20
   ```

2. **Verify database in container:**
   ```bash
   docker exec <container-name> ls -lh /app/database/
   docker exec <container-name> sqlite3 /app/database/wingspan.db "SELECT COUNT(*) FROM users;"
   ```

3. **Test the application:**
   - Log in to your production app
   - Verify data is present
   - Check that entries match your local database

## Alternative: Direct File Copy (Bind Mount)

Since the database is stored at `/home/scott/databases` (bind mount), you can work with it directly:

```bash
# 1. Stop container
docker stop <container-name>

# 2. Backup current database (optional)
cp /home/scott/databases/wingspan.db /home/scott/databases/wingspan.db.backup.$(date +%Y%m%d)

# 3. Copy your database file
cp /tmp/wingspan.db /home/scott/databases/wingspan.db
chown 1001:1001 /home/scott/databases/wingspan.db
chmod 644 /home/scott/databases/wingspan.db

# 4. Start container
docker start <container-name>
```

## Quick Reference Commands

```bash
# Find container
docker ps | grep wingspan

# Stop container
docker stop <container-name>

# Copy database (from local machine to server - Windows PowerShell)
scp .\database\wingspan.db user@server:/tmp/
# Or with full path:
scp C:\Users\scootypuffjr\Projects\wingspan-score\database\wingspan.db user@server:/tmp/

# Copy database to bind mount directory (on server)
sudo cp /tmp/wingspan.db /home/scott/databases/wingspan.db
sudo chown 1001:1001 /home/scott/databases/wingspan.db
sudo chmod 644 /home/scott/databases/wingspan.db

# OR copy into container (on server)
docker cp /tmp/wingspan.db <container-name>:/app/database/wingspan.db

# Start container
docker start <container-name>

# Verify
docker exec <container-name> sqlite3 /app/database/wingspan.db "SELECT COUNT(*) FROM users;"
```

## Troubleshooting

### Database Still Not Showing Data

1. **Check if file was copied:**
   ```bash
   docker exec <container-name> ls -lh /app/database/
   ```

2. **Check file permissions:**
   ```bash
   docker exec <container-name> ls -la /app/database/
   ```
   Should be owned by `nodejs` (UID 1001)

3. **Check if volume is mounted correctly:**
   ```bash
   docker inspect <container-name> | grep -A 10 Mounts
   ```

4. **Verify database is readable:**
   ```bash
   docker exec <container-name> sqlite3 /app/database/wingspan.db ".tables"
   ```

### Permission Errors

If you get permission errors:
```bash
# Fix permissions in container
docker exec -u root <container-name> chown -R nodejs:nodejs /app/database
docker exec -u root <container-name> chmod 644 /app/database/wingspan.db
```

---

**Remember:** Always stop the container before copying the database to avoid file locking issues!
