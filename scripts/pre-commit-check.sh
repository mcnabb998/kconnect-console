#!/bin/bash
# Pre-commit check script
# Runs all CI/CD pipeline checks locally before committing

set -e  # Exit on first error

echo "🔍 Running pre-commit checks..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILED=0

# Function to print status
print_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ $1${NC}"
        FAILED=1
    fi
}

# 1. Go Tests
echo -e "${YELLOW}[1/7] Running Go tests...${NC}"
(cd proxy && go test -v ./...) > /dev/null 2>&1
print_status "Go tests"

# 2. Go Formatting
echo -e "${YELLOW}[2/7] Checking Go formatting...${NC}"
(cd proxy && test -z "$(gofmt -s -l .)")
print_status "Go formatting (gofmt)"

# 3. Go Vet
echo -e "${YELLOW}[3/7] Running go vet...${NC}"
(cd proxy && go vet ./...) > /dev/null 2>&1
print_status "Go vet"

# 4. Node.js Tests
echo -e "${YELLOW}[4/7] Running React tests...${NC}"
(cd web && npm test -- --coverage -- --watchAll=false --silent) > /dev/null 2>&1
print_status "React tests"

# 5. TypeScript Check
echo -e "${YELLOW}[5/7] Running TypeScript type check...${NC}"
(cd web && npx tsc --noEmit) > /dev/null 2>&1
print_status "TypeScript check"

# 6. ESLint
echo -e "${YELLOW}[6/7] Running ESLint...${NC}"
(cd web && npx eslint . --ext .ts,.tsx --max-warnings 0) > /dev/null 2>&1
print_status "ESLint"

# 7. Build Check
echo -e "${YELLOW}[7/7] Running production build...${NC}"
(cd web && npm run build) > /dev/null 2>&1
print_status "Production build"

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ All checks passed! Safe to commit.${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ Some checks failed. Fix before committing.${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
