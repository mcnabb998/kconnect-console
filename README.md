# kconnect-console

A lightweight UI and proxy for managing Kafka Connect clusters

## Overview

This project provides a Dockerized Kafka Connect UI POC with the following components:

- **Go Proxy** (port 8080): Forwards requests to Kafka Connect REST API (port 8083) with credential redaction
- **React/Next.js Frontend** (port 3000): Modern UI with Tailwind CSS for managing connectors
- **Complete Kafka Stack**: Zookeeper, Kafka, and Kafka Connect with datagen plugin

## Features

### Proxy Service
- Routes: `/api/:cluster/connectors*`
- Redacts sensitive values (password, secret, token, key)
- CORS support for web UI
- Health check endpoint at `/health`

### Web UI
- List all connectors
- View connector status and configuration (with masked sensitive values)
- Pause/resume/restart connectors
- Delete connectors
- Real-time status updates

## Directory Structure

```
/proxy    - Go proxy service
/web      - React/Next.js frontend
/compose  - Docker Compose configuration
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- (Optional) Go 1.21+ for local development
- (Optional) Node.js 20+ for local development
- (Optional) Make for using Makefile commands

### Running with Docker Compose

**Using Make (recommended):**

```bash
# Start all services
make up

# View logs
make logs

# Stop services
make down

# Run tests
make test

# Create sample connector
make sample-connector
```

**Using Docker Compose directly:**

1. Start all services:
   ```bash
   cd compose
   docker-compose up -d
   ```

2. Wait for services to be ready (may take 1-2 minutes):
   ```bash
   docker-compose logs -f kafka-connect
   ```

3. Access the UI:
   - Web UI: http://localhost:3000
   - Proxy: http://localhost:8080
   - Kafka Connect: http://localhost:8083

4. Create a sample datagen connector:
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
         "tasks.max": "1"
       }
     }'
   ```

5. Stop all services:
   ```bash
   cd compose
   docker-compose down
   ```

### Local Development

#### Proxy Service
```bash
cd proxy
go mod download
go build -o proxy .
KAFKA_CONNECT_URL=http://localhost:8083 ./proxy
```

#### Web UI
```bash
cd web
npm install
npm run dev
```

## API Routes

### Proxy Endpoints

- `GET /health` - Health check
- `GET /api/:cluster/connectors` - List all connectors
- `GET /api/:cluster/connectors/:name` - Get connector details
- `GET /api/:cluster/connectors/:name/status` - Get connector status
- `POST /api/:cluster/connectors` - Create a new connector
- `PUT /api/:cluster/connectors/:name/pause` - Pause a connector
- `PUT /api/:cluster/connectors/:name/resume` - Resume a connector
- `PUT /api/:cluster/connectors/:name/restart` - Restart a connector
- `DELETE /api/:cluster/connectors/:name` - Delete a connector

## Monitoring

The proxy and web UI include light-weight monitoring features so that you can understand cluster health at a glance.

### Summary endpoint

- `GET /api/:cluster/monitoring/summary` - Returns an aggregate view of connector health for the selected cluster. The response payload includes:

| Field | Type | Description |
| --- | --- | --- |
| `cluster` | string | Cluster identifier that was queried. |
| `totalConnectors` | number | Total number of connectors discovered in Kafka Connect. |
| `runningConnectors` | number | Connectors whose tasks are all running. |
| `failedConnectors` | number | Connectors with at least one failed task. |
| `degradedConnectors` | number | Connectors with mixed running/failed tasks. |
| `pausedConnectors` | number | Connectors that are currently paused. |
| `lastUpdated` | string (ISO 8601) | When the summary was last refreshed from Kafka Connect. |
| `cacheTtlSeconds` | number | How long (in seconds) the proxy will reuse the cached response. |

To avoid repeatedly walking the Kafka Connect REST API, the proxy caches the computed summary in-memory for the duration specified by `cacheTtlSeconds` (currently 30 seconds). Subsequent requests within that window return the cached payload immediately, while requests after the TTL force a fresh refresh from Kafka Connect.

### Example request via the proxy

```bash
curl "${NEXT_PUBLIC_PROXY_URL:-http://localhost:8080}/api/${NEXT_PUBLIC_CLUSTER_ID:-default}/monitoring/summary" \
  -H "Accept: application/json"
```

### Monitoring in the web UI

The **Monitoring** page in the Next.js application visualizes the same summary data and surfaces a red failed-connector alert badge whenever `failedConnectors` is greater than zero. Configure the page by setting the build-time environment variables `NEXT_PUBLIC_PROXY_URL` (proxy base URL, e.g. `http://localhost:8080`) and `NEXT_PUBLIC_CLUSTER_ID` (cluster name, e.g. `default`). Once those variables are supplied and the frontend is built, the Monitoring page is available from the UI navigation alongside the connector list.

## Configuration

### Proxy Environment Variables

- `KAFKA_CONNECT_URL` - Kafka Connect REST API URL (default: http://localhost:8083)
- `PORT` - Proxy listen port (default: 8080)
- `ALLOWED_ORIGINS` - CORS allowed origins (default: *). For production, set to specific domains (e.g., "http://localhost:3000,https://yourdomain.com")

### Sensitive Data Redaction

The proxy automatically redacts fields containing:
- password
- secret
- token
- key
- credential
- auth

## Security Considerations

**CORS Configuration**: The default CORS configuration allows all origins (`*`) for development convenience. For production deployments:

1. Set the `ALLOWED_ORIGINS` environment variable to specific domains:
   ```bash
   ALLOWED_ORIGINS=https://yourdomain.com
   ```

2. Multiple origins can be comma-separated:
   ```bash
   ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
   ```

**Note**: When specific origins are configured, credentials are automatically enabled. With wildcard origins, credentials are disabled for security.

## License

MIT License - See LICENSE file for details
