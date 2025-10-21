# Pre-commit check script (PowerShell)
# Runs all CI/CD pipeline checks locally before committing

$ErrorActionPreference = "Continue"
$Failed = 0

Write-Host "`nRunning pre-commit checks...`n" -ForegroundColor Cyan

function Test-Command {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host "[$script:CheckNumber/7] $Name..." -ForegroundColor Yellow
    $script:CheckNumber++

    $null = & $Command 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[PASS] $Name" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        $script:Failed = 1
    }
}

$CheckNumber = 1

# 1. Go Tests
Test-Command "Go tests" {
    Push-Location proxy
    go test -v ./...
    Pop-Location
}

# 2. Go Formatting
Test-Command "Go formatting (gofmt)" {
    Push-Location proxy
    $output = gofmt -s -l .
    if ($output) { exit 1 } else { exit 0 }
    Pop-Location
}

# 3. Go Vet
Test-Command "Go vet" {
    Push-Location proxy
    go vet ./...
    Pop-Location
}

# 4. Node.js Tests
Test-Command "React tests" {
    Push-Location web
    npm test -- --coverage -- --watchAll=false --silent
    Pop-Location
}

# 5. TypeScript Check
Test-Command "TypeScript check" {
    Push-Location web
    npx tsc --noEmit
    Pop-Location
}

# 6. ESLint
Test-Command "ESLint" {
    Push-Location web
    npx eslint . --ext .ts,.tsx --max-warnings 0
    Pop-Location
}

# 7. Build Check
Test-Command "Production build" {
    Push-Location web
    npm run build
    Pop-Location
}

Write-Host ""
if ($Failed -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "[PASS] All checks passed! Safe to commit." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "X Some checks failed. Fix before committing." -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
