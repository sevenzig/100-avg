# 502 Bad Gateway Diagnostic Script
# Domain: 100avg.phelddagrif.farm
# Run this script on the server hosting the application

Write-Host "=== 502 Bad Gateway Diagnostic Script ===" -ForegroundColor Cyan
Write-Host "Domain: 100avg.phelddagrif.farm`n" -ForegroundColor Yellow

# Test 1: DNS Resolution
Write-Host "[1] Testing DNS Resolution..." -ForegroundColor Green
try {
    $dns = Resolve-DnsName -Name "100avg.phelddagrif.farm" -ErrorAction Stop
    Write-Host "  ✓ DNS resolves to: $($dns[0].IPAddress)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ DNS resolution failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: HTTPS Connectivity
Write-Host "`n[2] Testing HTTPS Connectivity..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "https://100avg.phelddagrif.farm/" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "  ✓ HTTPS connection successful" -ForegroundColor Green
    Write-Host "  Status Code: $($response.StatusCode)" -ForegroundColor Cyan
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $statusDesc = $_.Exception.Response.StatusDescription
    Write-Host "  ✗ HTTPS connection failed" -ForegroundColor Red
    Write-Host "  Status Code: $statusCode - $statusDesc" -ForegroundColor Yellow
    
    if ($statusCode -eq 502) {
        Write-Host "`n  ⚠️  502 Bad Gateway detected - Backend service is not reachable" -ForegroundColor Yellow
    }
}

# Test 3: Check Docker Containers (if Docker is installed)
Write-Host "`n[3] Checking Docker Containers..." -ForegroundColor Green
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $containers = docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Docker containers:" -ForegroundColor Cyan
        $containers | ForEach-Object { Write-Host "  $_" }
        
        # Check for 100avg related containers
        $relevantContainers = docker ps -a --format "{{.Names}}" | Select-String -Pattern "100avg|phelddagrif"
        if ($relevantContainers) {
            Write-Host "`n  Found relevant containers:" -ForegroundColor Yellow
            $relevantContainers | ForEach-Object {
                Write-Host "    - $_" -ForegroundColor Cyan
                $logs = docker logs --tail 20 $_ 2>&1
                Write-Host "    Recent logs:" -ForegroundColor Gray
                $logs | Select-Object -Last 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
            }
        }
    } else {
        Write-Host "  ⚠️  Docker not accessible or not running" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  Docker not installed" -ForegroundColor Yellow
}

# Test 4: Check Listening Ports
Write-Host "`n[4] Checking Listening Ports..." -ForegroundColor Green
$ports = @(3000, 5173, 8080, 8000)
foreach ($port in $ports) {
    $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listening) {
        Write-Host "  ✓ Port $port is listening" -ForegroundColor Green
        Write-Host "    Local Address: $($listening.LocalAddress)" -ForegroundColor Cyan
    } else {
        Write-Host "  ✗ Port $port is not listening" -ForegroundColor Red
    }
}

# Test 5: Test Backend Directly (bypass proxy)
Write-Host "`n[5] Testing Backend Directly (localhost)..." -ForegroundColor Green
$backendPorts = @(3000, 5173)
foreach ($port in $backendPorts) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "  ✓ Backend responding on port $port" -ForegroundColor Green
        Write-Host "    Status: $($response.StatusCode)" -ForegroundColor Cyan
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode) {
            Write-Host "  ⚠️  Port $port responded with status: $statusCode" -ForegroundColor Yellow
        } else {
            Write-Host "  ✗ Port $port not responding" -ForegroundColor Red
        }
    }
}

# Test 6: Check Reverse Proxy Configuration
Write-Host "`n[6] Checking for Reverse Proxy..." -ForegroundColor Green
$proxyServices = @("nginx", "caddy", "apache2")
foreach ($service in $proxyServices) {
    $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
    if ($svc) {
        Write-Host "  Found service: $service" -ForegroundColor Cyan
        Write-Host "    Status: $($svc.Status)" -ForegroundColor $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })
        
        if ($service -eq "nginx") {
            Write-Host "    Checking nginx config..." -ForegroundColor Gray
            $nginxTest = nginx -t 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "      ✓ Nginx configuration is valid" -ForegroundColor Green
            } else {
                Write-Host "      ✗ Nginx configuration has errors" -ForegroundColor Red
                $nginxTest | ForEach-Object { Write-Host "        $_" -ForegroundColor Red }
            }
        }
    }
}

# Test 7: Check System Resources
Write-Host "`n[7] Checking System Resources..." -ForegroundColor Green
$cpu = Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue
$mem = Get-CimInstance Win32_OperatingSystem | Select-Object @{Name="MemoryUsage";Expression={[math]::Round((($_.TotalVisibleMemorySize - $_.FreePhysicalMemory) / $_.TotalVisibleMemorySize) * 100, 2)}}
Write-Host "  Memory Usage: $($mem.MemoryUsage)%" -ForegroundColor $(if ($mem.MemoryUsage -lt 80) { 'Green' } else { 'Yellow' })

# Summary
Write-Host "`n=== Diagnostic Summary ===" -ForegroundColor Cyan
Write-Host "`nRecommended Actions:" -ForegroundColor Yellow
Write-Host "  1. Check if backend service is running" -ForegroundColor White
Write-Host "  2. Verify backend is listening on the correct port" -ForegroundColor White
Write-Host "  3. Check reverse proxy upstream configuration" -ForegroundColor White
Write-Host "  4. Review application logs for errors" -ForegroundColor White
Write-Host "  5. Verify firewall rules allow proxy->backend communication" -ForegroundColor White
Write-Host "`nFor detailed troubleshooting, see: 502_TROUBLESHOOTING.md" -ForegroundColor Gray
