# Docker Build Diagnostic Script
# This script helps identify build issues

Write-Host "=== Docker Build Diagnostics ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "1. Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "   ✓ Docker is available: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Docker is not available or not running" -ForegroundColor Red
    exit 1
}

# Check required files
Write-Host "`n2. Checking required files..." -ForegroundColor Yellow
$requiredFiles = @(
    "Dockerfile",
    "package.json",
    "package-lock.json",
    "vite.config.js",
    "svelte.config.js",
    "tsconfig.json"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "   ✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file is missing!" -ForegroundColor Red
    }
}

# Check .dockerignore
Write-Host "`n3. Checking .dockerignore..." -ForegroundColor Yellow
if (Test-Path ".dockerignore") {
    Write-Host "   ✓ .dockerignore exists" -ForegroundColor Green
    $dockerignore = Get-Content ".dockerignore" -Raw
    if ($dockerignore -match "\.svelte-kit") {
        Write-Host "   ✓ .svelte-kit is properly excluded" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ .svelte-kit might not be excluded" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠ .dockerignore not found (optional)" -ForegroundColor Yellow
}

# Validate package.json
Write-Host "`n4. Validating package.json..." -ForegroundColor Yellow
try {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    if ($packageJson.devDependencies.'@sveltejs/kit') {
        Write-Host "   ✓ @sveltejs/kit found in devDependencies" -ForegroundColor Green
    } else {
        Write-Host "   ✗ @sveltejs/kit not found in devDependencies!" -ForegroundColor Red
    }
    if ($packageJson.devDependencies.vite) {
        Write-Host "   ✓ vite found in devDependencies" -ForegroundColor Green
    } else {
        Write-Host "   ✗ vite not found in devDependencies!" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Failed to parse package.json: $_" -ForegroundColor Red
}

# Check package-lock.json
Write-Host "`n5. Checking package-lock.json..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    $lockSize = (Get-Item "package-lock.json").Length
    if ($lockSize -gt 0) {
        Write-Host "   ✓ package-lock.json exists and is not empty ($lockSize bytes)" -ForegroundColor Green
    } else {
        Write-Host "   ✗ package-lock.json is empty!" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ package-lock.json is missing!" -ForegroundColor Red
    Write-Host "   Run: npm install" -ForegroundColor Yellow
}

Write-Host "`n=== Ready to build ===" -ForegroundColor Cyan
Write-Host "Run: docker build -t wingspan-score ." -ForegroundColor White
