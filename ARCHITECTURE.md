# Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kafka Connect Console                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│   Browser    │  HTTP   │  Go Proxy    │  HTTP   │    Kafka     │
│  (React UI)  ├────────▶│  (Port 8080) ├────────▶│   Connect    │
│ Port 3000    │         │              │         │  (Port 8083) │
│              │◀────────│  - CORS      │◀────────│              │
└──────────────┘         │  - Redaction │         └──────┬───────┘
                         │  - Health    │                │
                         └──────────────┘                │
                                                          │
                         ┌──────────────┐         ┌─────▼────────┐
                         │              │         │              │
                         │  Zookeeper   │◀────────│    Kafka     │
                         │  (Port 2181) │         │  (Port 9092) │
                         │              │         │              │
                         └──────────────┘         └──────────────┘

Features:
  ✓ Credential Redaction (password, secret, token, key, credential, auth)
  ✓ CORS with configurable origins
  ✓ RESTful API proxy
  ✓ Real-time status updates
  ✓ Connector management (create, pause, resume, restart, delete)
  ✓ Modern React UI with Tailwind CSS
  ✓ Complete Kafka stack with datagen plugin

Directory Structure:
  /proxy    - Go proxy service
  /web      - React/Next.js frontend
  /compose  - Docker Compose configuration
```
