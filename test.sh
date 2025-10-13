#!/bin/bash
set -e

echo "Testing Kafka Connect Console POC..."
echo ""

# Test 1: Check Go proxy builds
echo "✓ Test 1: Building Go proxy..."
cd proxy
go build -o proxy .
if [ -f proxy ]; then
    echo "  ✓ Go proxy builds successfully"
    rm proxy
else
    echo "  ✗ Failed to build Go proxy"
    exit 1
fi
cd ..

# Test 2: Run Go tests
echo ""
echo "✓ Test 2: Running Go tests..."
cd proxy
go test -v
if [ $? -eq 0 ]; then
    echo "  ✓ All Go tests passed"
else
    echo "  ✗ Go tests failed"
    exit 1
fi
cd ..

# Test 3: Check Next.js builds
echo ""
echo "✓ Test 3: Building Next.js application..."
cd web
if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm ci > /tmp/npm-install.log 2>&1
fi
npm run build > /tmp/next-build.log 2>&1
if [ $? -eq 0 ]; then
    echo "  ✓ Next.js builds successfully"
else
    echo "  ✗ Failed to build Next.js"
    cat /tmp/next-build.log
    exit 1
fi
cd ..

# Test 4: Validate docker-compose file
echo ""
echo "✓ Test 4: Validating docker-compose configuration..."
cd compose
docker compose config > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✓ docker-compose.yml is valid"
else
    echo "  ✗ docker-compose.yml has errors"
    exit 1
fi
cd ..

# Test 5: Verify Dockerfiles
echo ""
echo "✓ Test 5: Checking Dockerfiles..."
if [ -f proxy/Dockerfile ]; then
    echo "  ✓ Proxy Dockerfile exists"
else
    echo "  ✗ Proxy Dockerfile missing"
    exit 1
fi

if [ -f web/Dockerfile ]; then
    echo "  ✓ Web Dockerfile exists"
else
    echo "  ✗ Web Dockerfile missing"
    exit 1
fi

echo ""
echo "=========================================="
echo "All tests passed! ✓"
echo "=========================================="
echo ""
echo "To start the full stack:"
echo "  cd compose"
echo "  docker compose up -d"
echo ""
echo "To stop the stack:"
echo "  cd compose"
echo "  docker compose down"
