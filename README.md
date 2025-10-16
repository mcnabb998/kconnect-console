# kconnect-console

A lightweight UI and proxy for managing Kafka Connect clusters

## Overview

This project provides a Dockerized Kafka Connect UI POC with the following components:

- **Go Proxy** (port 8080): Forwards requests to Kafka Connect REST API (port 8083) with credential redaction
- **React/Next.js Frontend** (port 3000): Modern UI with Tailwind CSS 4 and Next.js 15 App Router for managing connectors
- **Complete Kafka Stack**: Zookeeper, Kafka, and Kafka Connect with datagen plugin

## Features

### Proxy Service
- Routes: `/api/:cluster/connectors*`
- Redacts sensitive values (password, secret, token, key)
- CORS support for web UI
- Health check endpoint at `/health`

### Web UI
- List all connectors with status overview
- View detailed connector status and configuration (with masked sensitive values)
- Create new connectors using templates or custom configuration
- Pause/resume/restart connectors
- Delete connectors with confirmation
- Bulk operations on multiple connectors
- Real-time connector and task monitoring
- Cluster capabilities and plugin management
- Monitoring dashboard with health metrics
- Settings page with environment details

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

### Current Technology Stack

- **Backend**: Go 1.21 with Gorilla Mux router and CORS support
- **Frontend**: Next.js 15.5.4 with React 19.1.0 and Tailwind CSS 4
- **Testing**: Jest 29.7+ with 42 comprehensive tests across 6 test suites
- **Kafka Stack**: Confluent Platform 7.5.0 (Zookeeper, Kafka, Kafka Connect)

### Mirroring Images and Artifacts into Artifactory

If you run the stack in an isolated environment, mirror the following
dependencies into your internal Artifactory (or equivalent OCI registry) so the
Docker builds and `docker-compose` file can resolve all requirements.

#### Kafka stack dependencies (Confluent images)

These are the upstream Confluent images that power Zookeeper/Kafka/Kafka
Connect. They are the only artifacts required for the Kafka Connect cluster
itself.

| Image | Tag | Used By |
| --- | --- | --- |
| `confluentinc/cp-zookeeper` | `7.5.0` | `compose/docker-compose.yml` (`zookeeper` service) |
| `confluentinc/cp-kafka` | `7.5.0` | `compose/docker-compose.yml` (`kafka` service) |
| `confluentinc/cp-kafka-connect` | `7.5.0` | `compose/docker-compose.yml` (`kafka-connect` service) |

In addition, the Kafka Connect container installs the
`confluentinc/kafka-connect-datagen:latest` connector from Confluent Hub at
startup. Mirror that connector archive inside Artifactory (or configure Kafka
Connect to use your mirrored location) if outbound internet access is
restricted.

#### UI and proxy dependencies

The UI (`web` service) and proxy (`proxy` service) are built from source in this
repository. You have two options:

1. **Build locally inside your network** using the mirrored base images below.
2. **Pre-build and push** your own `kconnect-proxy` and `kconnect-web` images to
   Artifactory, then update `compose/docker-compose.yml` to reference those
   image names instead of building from the local Dockerfiles.

Regardless of the option you choose, mirror these base images so the Docker
build stages can run without internet access:

| Image | Tag | Used By |
| --- | --- | --- |
| `golang` | `1.21-alpine` | `proxy/Dockerfile` build stage |
| `alpine` | `latest` | `proxy/Dockerfile` runtime stage |
| `node` | `20-alpine` | `web/Dockerfile` build + runtime stages |

The web Dockerfile downloads npm packages during `npm ci`. For air-gapped
builds, configure npm to use your Artifactory npm registry mirror (for example
via an `.npmrc` file or the `NPM_CONFIG_REGISTRY` build argument) and pre-cache
the dependencies declared in `web/package.json`.

After mirroring, update your Dockerfiles and
`compose/docker-compose.yml` (or build-time args/environment) to reference the
Artifactory-hosted image and registry paths (for example,
`registry.internal.example.com/confluentinc/cp-kafka:7.5.0`).

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

## Development Setup

### Testing Infrastructure

This project includes comprehensive testing with high coverage across both backend and frontend:

**Test Coverage:**
- **Frontend**: 42 Jest tests across 6 test suites covering React components and API interactions
- **Backend**: Go tests with coverage for proxy handlers, credential redaction, and monitoring
- **Integration**: Full Docker stack validation and end-to-end testing

**Run all tests:**
```bash
# Using Make (recommended)
make test

# Or individually
cd proxy && go test -v -cover ./...
cd web && npm test -- --coverage
```

**CI/CD Pipeline:**
- GitHub Actions automatically run tests on every push
- Integration tests validate the full Docker stack
- Pre-commit hooks ensure code quality

**Set up pre-commit hooks:**
```bash
# Install pre-commit hooks for automatic code quality checks
./scripts/setup-precommit.sh
```

The pre-commit hooks will automatically run:
- Go tests and formatting
- React tests and TypeScript checking
- Code linting and formatting

### Local Development (without Docker)

**Prerequisites:**
- Go 1.21+ 
- Node.js 20+
- Running Kafka Connect instance (for proxy development)

**Start the proxy:**
```bash
cd proxy
KAFKA_CONNECT_URL=http://localhost:8083 go run main.go
# Available at http://localhost:8080
```

**Start the web UI:**
```bash
cd web
npm install
npm run dev
# Available at http://localhost:3000
```

**Environment variables for web development:**
```bash
# web/.env.local
NEXT_PUBLIC_PROXY_URL=http://localhost:8080
NEXT_PUBLIC_CLUSTER_ID=default
```

### Web UI Pages and Features

The application includes the following pages accessible via navigation:

- **Home (/)**: Main dashboard with connector list, bulk actions, and overview metrics
- **Connectors (/connectors)**: Dedicated connector list view with detailed status cards
- **New Connector (/connectors/new)**: Multi-step connector creation wizard
- **Connector Templates (/connectors/templates)**: Pre-configured connector templates with plugin availability indicators
- **Connector Detail (/connectors/[name])**: Individual connector management with actions and configuration view
- **Monitoring (/monitoring)**: Cluster health dashboard with real-time metrics
- **Cluster (/cluster)**: Worker and task distribution overview
- **Settings (/settings)**: Environment details and connector plugin management
- **Capabilities (/capabilities)**: Kafka Connect cluster capabilities and features

### Integration Testing

For full end-to-end testing with the complete Kafka stack:

```bash
cd compose
docker compose up -d
# Wait for services to start (~2 minutes)
# Test endpoints:
curl http://localhost:8080/health
curl http://localhost:8080/api/default/connectors
curl http://localhost:8080/api/default/monitoring/summary
```

## Project Architecture

### Error Handling and Resilience

The application includes robust error handling:

- **Proxy**: Graceful degradation when Kafka Connect is unavailable with informative error responses
- **Frontend**: Comprehensive error boundaries and user-friendly error messages
- **Network**: Automatic retry logic and connection status indicators
- **Validation**: Input validation for connector configurations and bulk operations

### Key Design Patterns

- **Next.js App Router**: Modern routing with server and client components
- **TypeScript**: Full type safety across the entire frontend
- **Responsive Design**: Mobile-first approach with Tailwind CSS 4
- **Component Architecture**: Reusable UI components with proper separation of concerns
- **API Abstraction**: Centralized API calls through utility functions

## API Routes

### Proxy Endpoints

- `GET /health` - Health check
- `GET /api/:cluster/connectors` - List all connectors  
- `GET /api/:cluster/connectors/:name` - Get connector details
- `GET /api/:cluster/connectors/:name/status` - Get connector status
- `GET /api/:cluster/connector-plugins` - List available connector plugins
- `GET /api/:cluster/monitoring/summary` - Get cluster monitoring summary
- `POST /api/:cluster/connectors` - Create a new connector
- `PUT /api/:cluster/connectors/:name/pause` - Pause a connector
- `PUT /api/:cluster/connectors/:name/resume` - Resume a connector
- `POST /api/:cluster/connectors/:name/restart` - Restart a connector
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

To avoid repeatedly walking the Kafka Connect REST API, the proxy caches the computed summary in-memory for the duration specified by `cacheTtlSeconds` (currently 10 seconds). Subsequent requests within that window return the cached payload immediately, while requests after the TTL force a fresh refresh from Kafka Connect.

### Example request via the proxy

```bash
curl "${NEXT_PUBLIC_PROXY_URL:-http://localhost:8080}/api/${NEXT_PUBLIC_CLUSTER_ID:-default}/monitoring/summary" \
  -H "Accept: application/json"
```

### Monitoring in the web UI

The web application includes several monitoring and management pages:

- **Home Dashboard**: Overview of all connectors with bulk actions and health status
- **Monitoring Page**: Visualizes cluster summary data with real-time health metrics and failed-connector alerts  
- **Cluster Page**: Detailed view of cluster status including workers and task distribution
- **Settings Page**: Environment configuration, connector plugins, and system capabilities
- **Capabilities Page**: Kafka Connect cluster capabilities and plugin availability

Configure the application by setting the build-time environment variables `NEXT_PUBLIC_PROXY_URL` (proxy base URL, e.g. `http://localhost:8080`) and `NEXT_PUBLIC_CLUSTER_ID` (cluster name, e.g. `default`). All monitoring features are accessible from the main navigation.

## Configuration

### Proxy Environment Variables

- `KAFKA_CONNECT_URL` - Kafka Connect REST API URL (default: http://localhost:8083)
- `PORT` - Proxy listen port (default: 8080)
- `ALLOWED_ORIGINS` - CORS allowed origins (default: *). For production, set to specific domains (e.g., "http://localhost:3000,https://yourdomain.com")

### Sensitive Data Redaction

The proxy automatically redacts fields containing sensitive patterns while preserving legitimate configuration keys:

**Redacted patterns:**
- password, secret, token, key, credential, auth (and variations)

**Protected keys (never redacted):**
- `key.converter`, `value.converter`
- `internal.key.converter`, `internal.value.converter`

This ensures security while maintaining proper Kafka Connect functionality.

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
