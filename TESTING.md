# Testing Guide

This guide explains how to test the Kafka Connect Console POC.

## Quick Test

Run the automated test suite:

```bash
make test
```

This will verify:
- Go proxy unit tests pass with coverage reporting
- Web Vitest suites pass with coverage reporting

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
