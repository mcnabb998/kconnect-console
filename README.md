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

### Running with Docker Compose

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

## Configuration

### Proxy Environment Variables

- `KAFKA_CONNECT_URL` - Kafka Connect REST API URL (default: http://localhost:8083)
- `PORT` - Proxy listen port (default: 8080)

### Sensitive Data Redaction

The proxy automatically redacts fields containing:
- password
- secret
- token
- key
- credential
- auth

## License

MIT License - See LICENSE file for details
