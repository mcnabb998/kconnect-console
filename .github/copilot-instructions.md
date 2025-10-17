# Copilot Instructions for kconnect-console

## Project Overview
A Kafka Connect management console with Go proxy (credential redaction, CORS) and Next.js UI. Three Docker services: `kconnect-proxy` (:8080), `kconnect-web` (:3000), and a Kafka stack (Kafka Connect :8083, Kafka :9092, Zookeeper :2181).

**Current Tech Stack:**
- **Backend**: Go 1.21 with Gorilla Mux router 
- **Frontend**: Next.js 15.5.4 with React 19.1.0, Tailwind CSS 4, TypeScript
- **Testing**: Jest 29.7+ (46 tests across 7 suites), Go testing with coverage
- **Architecture**: Next.js App Router, server/client components

## Critical Architecture Rules

### 1. Kafka Network Configuration ⚠️
**Never change these without understanding the consequences:**
- Kafka Connect **must** use `kafka:9092` (internal Docker network)
- External access uses `localhost:29092` (debugging only)
- Port 9092 is for container-to-container communication
- See `compose/docker-compose.yml` for the complete listener configuration

### 2. Proxy URL Routing Pattern
The proxy strips the `/api/:cluster` prefix before forwarding to Kafka Connect:
- `/api/default/connectors` → `/connectors` (Kafka Connect)
- `/api/default/connector-plugins` → `/connector-plugins`
- `/api/default/connectors/name/status` → `/connectors/name/status`

Logic lives in `proxy/main.go` `proxyHandler()`. Test all endpoint variations after routing changes.

### 3. Credential Redaction (Security)
Pattern in `proxy/main.go`:
```go
sensitivePattern = regexp.MustCompile(`(?i)(?:^|[._-]|[a-z0-9])(password|secret|api[._-]?key|access[._-]?key|secret[._-]?key|token|credential(s)?)(?:$|[._-]|[a-z0-9])`)
```
**Safe keys** (never redact): `key.converter`, `value.converter`, `internal.key.converter`, `internal.value.converter`

Test redaction preserves legitimate config fields while hiding secrets.

### 4. HTTP Method Routing
Kafka Connect API requires specific methods:
- `POST /connectors/{name}/restart` ✓
- `PUT /connectors/{name}/pause` ✓
- `PUT /connectors/{name}/resume` ✓

See `web/app/connectors/[name]/page.tsx` for implementation pattern.

## Development Workflows

### Essential Commands
```bash
# Start full stack
make up

# Run all tests (Go + Node.js)
make test

# Create sample connector
make sample-connector

# View logs
make logs

# Individual service tests
make test-proxy    # Go tests with coverage
make test-web      # Jest tests with coverage
```

### Testing After Changes
1. Rebuild: `docker compose -f compose/docker-compose.yml build <service>`
2. Restart: `make up`
3. Verify:
   - `curl http://localhost:8080/api/default/connectors`
   - `curl http://localhost:8080/api/default/connector-plugins`
   - Check UI at http://localhost:3000
   - Create test connector and verify redaction

### Local Development (Without Docker)
```bash
# Proxy (requires Kafka Connect at :8083)
make dev-proxy

# Web UI
make dev-web
```

### Key Application Structure
- **Root Layout**: `web/app/layout.tsx` provides global providers (MonitoringSummaryProvider, ErrorBoundary)
- **Navigation**: Sidebar navigation in `web/app/components/Navigation.tsx`
- **Pages**: 9 distinct routes including dynamic `[name]` connector details
- **Global State**: React Context for monitoring data, no external state management

## Code Patterns

### Frontend (Next.js 15 App Router)
- **Client components**: Use `'use client'` directive for interactive components
- **API calls**: Use `web/lib/api.ts` utilities, not direct fetch
- **Environment**: `NEXT_PUBLIC_PROXY_URL` defaults to `http://localhost:8080`
- **Routing**: Next.js App Router in `web/app/` with dynamic routes `[name]/page.tsx`
- **Styling**: Tailwind CSS 4 (see `web/app/globals.css`)
- **Types**: Centralized in `web/types/connect.ts` for Kafka Connect API objects

Example from `web/lib/api.ts`:
```typescript
const PROXY = typeof window !== 'undefined' ? 'http://localhost:8080' : 'http://kconnect-proxy:8080';
```

### Backend (Go Proxy)
- **Error handling**: Return `connectUnavailableError` for unreachable Kafka Connect
- **URL construction**: Use `joinURL()` helper, not string concatenation
- **Testing**: Use `testutils` package for mock servers (see `proxy/testutils/`)
- **Monitoring cache**: TTL-based caching for `/monitoring/summary` (10s default)

### Connector Templates
Pre-configured templates in `web/data/connectorTemplates.ts`:
- Include `connectorClass`, `type`, `category`, `defaultConfig`, `requiredFields`
- UI dynamically checks plugin availability via `/connector-plugins` endpoint
- Visual indicators: 🟢 Available / 🔴 Missing plugin

### Component Architecture
- **Bulk Actions**: `ConnectorBulkActions.tsx` handles multiple connector operations
- **Dynamic Forms**: `DynamicField.tsx` renders connector config fields by type
- **Skeletons**: `Skeleton.tsx` provides loading states with proper accessibility
- **Transformations**: Dedicated tab for SMT (Single Message Transform) configuration

## Testing Conventions

### Go Tests (`proxy/`)
- Use table-driven tests with `t.Run()`
- Mock HTTP servers via `testutils/test_server.go`
- Coverage reports to `coverage.out`
- Run: `go test -v -cover ./...`

### Jest Tests (`web/`)
- **46 tests across 7 suites** covering components and API interactions
- Config: `jest.config.js`, setup in `jest.setup.ts`
- Test files: `__tests__/*.test.tsx` or `*.test.ts`
- Run: `npm run test -- --coverage`
- Use Testing Library for React components
- **Test patterns**: Mock fetch, test error boundaries, validate user interactions

## Common Pitfalls

1. **Port confusion**: Use `kafka:9092` for internal Docker network, not `localhost:9092`
2. **Over-broad redaction**: Always test that `key.converter` fields are NOT redacted
3. **Environment variables**: `NEXT_PUBLIC_*` are build-time, embed defaults for runtime
4. **Signal handling**: Use `exec` form in Dockerfiles for proper shutdown
5. **URL encoding**: Connector names must be URL-escaped in API calls

## Key Files Reference
- `proxy/main.go`: Core proxy logic, credential redaction, monitoring
- `web/lib/api.ts`: Frontend API utilities, plugin availability checking
- `compose/docker-compose.yml`: Service definitions and critical Kafka listeners config
- `web/data/connectorTemplates.ts`: Predefined connector templates
- `web/types/connect.ts`: TypeScript types for Kafka Connect API objects
- `web/components/`: Reusable UI components (Skeleton, DynamicField, etc.)
- `web/app/`: Next.js App Router pages (9 distinct routes)
- `Makefile`: All development commands

## AI Agent Best Practices
- Read `AI-AGENT.md` for detailed troubleshooting and architecture deep-dive
- Always test credential redaction after proxy changes
- Verify all connector operations (list, create, pause, resume, restart, delete) after routing changes
- Check that UI shows plugin availability indicators after template changes
- Run `make test` before committing to ensure Go and Node.js tests pass
