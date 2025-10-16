# Testing Guide

This guide explains how to test the Kafka Connect Console POC.

## End-to-End Testing Strategy

Our testing approach is layered so every critical workflow is covered by
repeatable automation and supported by lightweight manual smoke checks when
necessary.

| Layer | Goal | Primary Tools | Key Scenarios |
| ----- | ---- | ------------- | ------------- |
| Unit | Validate pure functions and error branches in isolation. | `go test`, `node --test`, `jest` | URL builders, state normalisation, API helpers, UI rendering fallbacks. |
| Functional | Exercise HTTP boundaries without external dependencies. | Go `httptest`, React Testing Library | Proxy routing, redaction, monitoring summary aggregation, UI state management. |
| Integration | Ensure the proxy, Kafka Connect API, and UI communicate correctly. | `make test`, Docker Compose (optional) | CRUD flows, connector actions, cluster insights, credential masking. |
| End-to-End | Validate production-like behaviour with the full stack. | `docker compose up`, browser sanity checks | Provisioning connectors, action buttons, status dashboards, CORS validation. |

### Automation Entry Points

- `make test` – runs backend (`go test`) and frontend (`npm run test -- --coverage`) suites with coverage reports.
- `npm run test -- --watch` – executes the Node and Jest suites in watch mode for fast feedback during UI work.
- `go test ./proxy/... -run <pattern>` – scopes backend checks to targeted packages.

### Coverage Expectations

- **Proxy (Go):** Critical packages target ~95–100% statement coverage. Helper utilities are included to ensure regression
  protection for routing, redaction, and monitoring logic.
- **Web (Next.js):** UI logic and API helpers target high confidence coverage (~90%+) using a mix of Jest + Testing Library and
  the Node test runner. Snapshot-like assertions are avoided in favour of behaviour checks.
- Coverage thresholds are enforced manually via `go tool cover -func` and Jest's coverage summary during CI/CD.

### Functional & Integration Checklist

1. **Proxy routing smoke test** – `go test ./proxy/...` spins up in-memory Kafka Connect stubs and asserts the proxy forwards
   GET/POST/PUT/DELETE calls correctly while redacting secrets.
2. **Monitoring summary aggregation** – the Go suite seeds multi-connector fixtures and verifies uptime derivation, state
   aggregation, and caching semantics.
3. **UI orchestration** – Jest tests render the connectors dashboard and detail pages, mocking `fetch` to simulate happy-path,
   error, and loading states. Bulk actions are validated end-to-end by faking API responses.
4. **API contract tests** – the `web/lib/api` helpers are exercised against a mocked `fetch`, ensuring errors propagate with
   contextual messaging and HTTP verbs are correct.
5. **Accessibility fallbacks** – loading and empty states assert on accessible roles (`role="status"`, `aria-busy`) so the UI
   remains usable with assistive technology.

### Regression Windows

- Run `make test` before every commit – it is fast (<1 minute) and validates both layers.
- For changes touching Docker or Kafka Connect wiring, execute the full stack instructions in the next section to surface
  integration regressions early.

## Quick Test

Run the automated test suite:

```bash
make test
```

This will verify:
- Go proxy unit tests pass with coverage reporting
- Web Node.js test suites pass with coverage reporting

## Full Integration Test

### 1. Start the Stack

```bash
cd compose
docker compose up -d
```

Wait for all services to start (1-2 minutes). Monitor the logs:

```bash
docker compose logs -f kafka-connect
```

Wait until you see "Kafka Connect started" in the logs.

### 2. Verify Services

Check that all services are running:

```bash
docker compose ps
```

You should see:
- zookeeper (port 2181)
- kafka (port 9092)
- kafka-connect (port 8083)
- kconnect-proxy (port 8080)
- kconnect-web (port 3000)

### 3. Test the Proxy

Check proxy health:

```bash
curl http://localhost:8080/health
```

Expected output:
```json
{"status":"healthy"}
```

List connectors (should be empty initially):

```bash
curl http://localhost:8080/api/default/connectors
```

Expected output:
```json
[]
```

### 4. Test Credential Redaction

Create a connector with sensitive data:

```bash
./create-sample-connector.sh
```

Or manually:

```bash
curl -X POST http://localhost:8080/api/default/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "datagen-users",
    "config": {
      "connector.class": "io.confluent.kafka.connect.datagen.DatagenConnector",
      "kafka.topic": "users",
      "quickstart": "users",
      "key.converter": "org.apache.kafka.connect.storage.StringConverter",
      "value.converter": "org.apache.kafka.connect.json.JsonConverter",
      "value.converter.schemas.enable": "false",
      "max.interval": 1000,
      "iterations": 10000000,
      "tasks.max": "1",
      "database.password": "supersecret123",
      "api.key": "my-secret-api-key"
    }
  }'
```

Now retrieve the connector config:

```bash
curl http://localhost:8080/api/default/connectors/datagen-users
```

**Verify**: The response should show `***REDACTED***` for `database.password` and `api.key` fields.

### 5. Test the Web UI

1. Open http://localhost:3000 in your browser
2. You should see the connector list page
3. Click on "datagen-users" connector
4. Verify:
   - Status shows "RUNNING"
   - Configuration is displayed
   - Sensitive fields are masked as `***REDACTED***`
   - Action buttons (Pause, Resume, Restart, Delete) are visible

### 6. Test Connector Actions

Using the web UI:

1. Click "Pause" - connector should pause
2. Click "Resume" - connector should resume
3. Click "Restart" - connector should restart

Or via API:

```bash
# Pause
curl -X PUT http://localhost:8080/api/default/connectors/datagen-users/pause

# Check status
curl http://localhost:8080/api/default/connectors/datagen-users/status

# Resume
curl -X PUT http://localhost:8080/api/default/connectors/datagen-users/resume

# Restart
curl -X PUT http://localhost:8080/api/default/connectors/datagen-users/restart
```

### 7. Test CORS

Open browser console at http://localhost:3000 and run:

```javascript
fetch('http://localhost:8080/api/default/connectors')
  .then(r => r.json())
  .then(console.log)
```

The request should succeed (no CORS errors).

### 8. Clean Up

Stop and remove all containers:

```bash
cd compose
docker compose down
```

To also remove volumes:

```bash
docker compose down -v
```

## Unit Tests

### Go Proxy Tests

```bash
cd proxy
go test -v
```

Tests include:
- Simple password field redaction
- Nested secret field redaction
- Array with sensitive data
- Case insensitive matching

### Test Coverage

Generate coverage report:

```bash
cd proxy
go test -cover
go test -coverprofile=coverage.out
go tool cover -html=coverage.out
```

## Manual Testing Checklist

- [ ] All services start successfully
- [ ] Proxy health check returns healthy
- [ ] Can list connectors
- [ ] Can create connector via proxy
- [ ] Sensitive data is redacted in responses
- [ ] Web UI loads successfully
- [ ] Connector list displays correctly
- [ ] Connector detail page shows status
- [ ] Configuration is displayed with masked values
- [ ] Pause button works
- [ ] Resume button works
- [ ] Restart button works
- [ ] Delete button works (with confirmation)
- [ ] CORS allows web UI to call proxy
- [ ] No errors in browser console
- [ ] No errors in proxy logs
- [ ] No errors in Kafka Connect logs

## Troubleshooting

### Services won't start

Check logs for specific service:
```bash
docker compose logs [service-name]
```

### Proxy can't connect to Kafka Connect

Ensure Kafka Connect is fully started:
```bash
docker compose logs kafka-connect | tail -20
```

### Web UI shows connection errors

Check proxy is running:
```bash
curl http://localhost:8080/health
```

Check browser console for CORS or network errors.

### Connector creation fails

Ensure:
1. Kafka is running: `docker compose ps kafka`
2. Topics are created: `docker compose logs kafka`
3. Datagen plugin is installed: `docker compose logs kafka-connect | grep datagen`
