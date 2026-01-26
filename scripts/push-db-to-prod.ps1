# PowerShell script to push local database to production
# Usage: .\scripts\push-db-to-prod.ps1

$ErrorActionPreference = "Stop"

$dbDir = Join-Path $PSScriptRoot "..\database"
$localDbPath = Join-Path $dbDir "wingspan.db"
$backupDbPath = Join-Path $dbDir "wingspan.db.backup"

Write-Host "🔄 Pushing local database to production...`n" -ForegroundColor Cyan

# Check if local database exists
if (-not (Test-Path $localDbPath)) {
    Write-Host "❌ Local database not found at: $localDbPath" -ForegroundColor Red
    Write-Host "   Please ensure the database exists before pushing to production." -ForegroundColor Red
    exit 1
}

# Create backup of local database first
Write-Host "📦 Creating backup of local database..." -ForegroundColor Yellow
try {
    Copy-Item -Path $localDbPath -Destination $backupDbPath -Force
    Write-Host "   ✓ Backup created at: $backupDbPath" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create backup: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 Choose deployment method:`n" -ForegroundColor Cyan
Write-Host "1. Docker Compose (if using docker-compose.prod.yml)"
Write-Host "2. Dokploy (if using Dokploy platform)"
Write-Host "3. Manual Docker commands`n"

# For Docker Compose method
Write-Host "🐳 Docker Compose Method:" -ForegroundColor Yellow
Write-Host "   Run these commands:`n"
Write-Host "   # Stop the production container"
Write-Host "   docker-compose -f docker-compose.prod.yml stop app`n"
Write-Host "   # Copy database to container"
Write-Host "   docker cp $localDbPath wingspan-score-prod:/app/database/wingspan.db`n"
Write-Host "   # Start the container"
Write-Host "   docker-compose -f docker-compose.prod.yml start app`n"

# For Dokploy method
Write-Host "🚀 Dokploy Method (IMPORTANT: Stop container first!):" -ForegroundColor Yellow
Write-Host "   Option 1: Via SSH (Recommended)"
Write-Host "   1. SSH into your Dokploy server"
Write-Host "   2. Find your container name:"
Write-Host "      docker ps | grep wingspan`n"
Write-Host "   3. ⚠️  STOP the container first (required!):"
Write-Host "      docker stop <container-name>`n"
Write-Host "      OR use Dokploy UI: Application → Stop`n"
Write-Host "   4. Copy database to container (from your local machine):"
Write-Host "      scp $localDbPath user@server:/tmp/wingspan.db`n"
Write-Host "   5. On server, copy into container:"
Write-Host "      docker cp /tmp/wingspan.db <container-name>:/app/database/wingspan.db`n"
Write-Host "   6. Start container:"
Write-Host "      docker start <container-name>`n"
Write-Host "      OR use Dokploy UI: Application → Start`n"
Write-Host "   Option 2: Via Dokploy File Manager (if available)"
Write-Host "   1. Use Dokploy UI file manager"
Write-Host "   2. Upload database file to /app/database/wingspan.db"
Write-Host "   3. Restart the application`n"

# For manual Docker method
Write-Host "🔧 Manual Docker Method:" -ForegroundColor Yellow
Write-Host "   # Find your production container"
Write-Host "   docker ps | grep wingspan`n"
Write-Host "   # Copy database (replace <container-name> with actual name)"
Write-Host "   docker cp $localDbPath <container-name>:/app/database/wingspan.db`n"
Write-Host "   # Restart container"
Write-Host "   docker restart <container-name>`n"

Write-Host "⚠️  IMPORTANT NOTES:" -ForegroundColor Red
Write-Host "   - ⚠️  YOU MUST STOP THE CONTAINER FIRST to avoid file locking issues!"
Write-Host "   - SQLite locks the database file when the app is running"
Write-Host "   - This will REPLACE the production database"
Write-Host "   - Make sure to backup production database first if needed"
Write-Host "   - The local database backup is saved at: $backupDbPath"
Write-Host "   - After pushing, verify the database in production`n"

Write-Host "✅ Local database is ready to push!" -ForegroundColor Green
Write-Host "   Follow the instructions above for your deployment method.`n"

# Ask if user wants to proceed with Docker Compose method
$response = Read-Host "Do you want to proceed with Docker Compose method automatically? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "`n🔄 Executing Docker Compose commands...`n" -ForegroundColor Cyan
    
    try {
        # Check if container exists
        $containerExists = docker ps -a --filter "name=wingspan-score-prod" --format "{{.Names}}"
        if (-not $containerExists) {
            Write-Host "⚠️  Container 'wingspan-score-prod' not found." -ForegroundColor Yellow
            Write-Host "   Please check your container name and run manually." -ForegroundColor Yellow
            exit 0
        }
        
        # Stop container
        Write-Host "⏸️  Stopping container..." -ForegroundColor Yellow
        docker-compose -f docker-compose.prod.yml stop app
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Failed to stop container. Continuing anyway..." -ForegroundColor Yellow
        }
        
        # Copy database
        Write-Host "📤 Copying database to container..." -ForegroundColor Yellow
        docker cp $localDbPath wingspan-score-prod:/app/database/wingspan.db
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to copy database to container." -ForegroundColor Red
            Write-Host "   Please check container name and try manually." -ForegroundColor Red
            exit 1
        }
        Write-Host "   ✓ Database copied successfully" -ForegroundColor Green
        
        # Start container
        Write-Host "▶️  Starting container..." -ForegroundColor Yellow
        docker-compose -f docker-compose.prod.yml start app
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Failed to start container. Please start manually." -ForegroundColor Yellow
        } else {
            Write-Host "   ✓ Container started" -ForegroundColor Green
        }
        
        Write-Host "`n✅ Database push completed!" -ForegroundColor Green
        Write-Host "   Verify the database in production to ensure it's working correctly.`n" -ForegroundColor Cyan
        
    } catch {
        Write-Host "❌ Error during execution: $_" -ForegroundColor Red
        Write-Host "   Please run the commands manually using the instructions above." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "`n📝 Manual instructions displayed above. Run the commands when ready.`n" -ForegroundColor Cyan
}
