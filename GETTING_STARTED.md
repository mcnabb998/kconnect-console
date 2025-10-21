# Getting Started with kconnect-console

**Welcome!** This guide will have you up and running with kconnect-console in under 10 minutes.

## 📋 What You'll Get

By the end of this guide, you'll have:
- ✅ kconnect-console UI and proxy running
- ✅ Connected to your existing Kafka Connect cluster
- ✅ Real-time monitoring and management capabilities

**Note:** kconnect-console is a **management UI only**. It assumes you already have:
- ✅ Kafka Connect cluster running
- ✅ Kafka broker(s) accessible
- ✅ (Optional) Zookeeper if using older Kafka versions

For local development/testing, we provide a Docker Compose stack that includes everything.

---

## 🎯 Choose Your Path

### Path A: Connect to Existing Kafka Connect ⭐ (Most Common)
**You already have Kafka Connect running** and want to add a UI for it.
- ✅ Production environments
- ✅ Existing Kafka clusters
- ✅ Cloud deployments (AWS MSK, Confluent Cloud, etc.)

**👉 Skip to: [Connect to Existing Kafka Connect](#-connect-to-existing-kafka-connect)**

### Path B: Full Stack for Local Development
**You want to test/learn** and don't have Kafka Connect yet.
- ✅ Local development
- ✅ Testing and experimentation
- ✅ Demos and proof-of-concepts

**👉 Continue below: [Full Stack Setup](#-full-stack-setup-docker-compose)**

---

## 🔌 Connect to Existing Kafka Connect

**Best for**: Production, cloud environments, existing Kafka infrastructure

This deploys **only** the kconnect-console UI and proxy - no Kafka stack.

### Prerequisites

- **Existing Kafka Connect cluster** with REST API accessible
- **Docker** 20.10+ OR **Kubernetes** cluster
- **Network access** from deployment to Kafka Connect REST API

### Step 1: Clone the Repository

```bash
git clone https://github.com/mcnabb998/kconnect-console.git
cd kconnect-console
```

### Step 2: Configure Connection

Create `compose/.env` file:

```env
# Your Kafka Connect REST API endpoint
KAFKA_CONNECT_URL=http://your-kafka-connect:8083

# Proxy will listen on this port
PORT=8080

# UI will be accessible via browser
NEXT_PUBLIC_PROXY_URL=http://localhost:8080

# Optional: Your cluster name
NEXT_PUBLIC_CLUSTER_ID=production

# CORS: Set to your domain in production
ALLOWED_ORIGINS=*
```

**Examples:**

```env
# AWS MSK Connect
KAFKA_CONNECT_URL=http://your-msk-connect-endpoint.region.amazonaws.com:8083

# Confluent Platform
KAFKA_CONNECT_URL=http://connect-cluster.yourcompany.com:8083

# Kubernetes service
KAFKA_CONNECT_URL=http://kafka-connect.kafka.svc.cluster.local:8083
```

### Step 3: Deploy UI + Proxy Only

**Option A: Docker Compose (Recommended for Testing)**

```bash
cd compose
docker compose up -d kconnect-proxy kconnect-web
```

This starts only 2 containers:
- **kconnect-proxy** (port 8080) - API proxy
- **kconnect-web** (port 3000) - Web UI

**Option B: Kubernetes/Helm**

See [Kubernetes Deployment](#-kubernetes-deployment-helm) section below.

### Step 4: Verify Connection

```bash
# Test proxy can reach your Kafka Connect
curl http://localhost:8080/health

# Should return: {"status":"healthy","kafka_connect":"up"}
```

### Step 5: Access the UI

Open your browser:

**🌐 http://localhost:3000**

You should see your existing connectors!

---

## 📦 Full Stack Setup (Docker Compose)

**Best for**: Local development, testing, learning

This deploys kconnect-console **plus** a complete Kafka stack.

### Prerequisites

- **Docker** 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.0+ (included with Docker Desktop)
- **8GB RAM** minimum (recommended: 16GB)
- **Ports available**: 3000, 8080, 8083, 9092, 2181

### Step 1: Clone the Repository

```bash
git clone https://github.com/mcnabb998/kconnect-console.git
cd kconnect-console
```

### Step 2: Start the Stack

```bash
cd compose
docker compose up -d
```

This will start 5 containers:
- **Zookeeper** (port 2181) - Kafka coordination
- **Kafka** (port 9092) - Message broker
- **Kafka Connect** (port 8083) - Connect framework
- **kconnect-proxy** (port 8080) - API proxy
- **kconnect-web** (port 3000) - Web UI

**First startup takes 2-3 minutes** as containers download and Kafka Connect initializes.

### Step 3: Verify Everything is Running

```bash
# Check all containers are healthy
docker compose ps

# Should show 5 containers with status "Up"
```

Wait for all services to be healthy (1-2 minutes), then verify:

```bash
# Test Kafka Connect API
curl http://localhost:8083/connectors

# Test Proxy health
curl http://localhost:8080/health

# Test Web UI
curl http://localhost:3000
```

### Step 4: Open the UI

Open your browser to:

**🌐 http://localhost:3000**

You should see the kconnect-console dashboard!

---

## 📖 What Can You Do Now?

### View the Cluster Overview
- Navigate to **Cluster** in the sidebar
- See Kafka Connect version, workers, and health status

### Create Your First Connector

1. Click **"Create Connector"** button
2. Choose **"DataGen Source"** template (generates sample data)
3. Configure:
   - **Name**: `test-datagen`
   - **Kafka Topic**: `test-topic`
   - **Max Interval**: `1000` (generates 1 record/second)
4. Click **"Create"**
5. Watch it appear in the connector list with status **RUNNING**

### Monitor Connectors

- **List View**: See all connectors with real-time status
- **Detail View**: Click any connector to see:
  - Task status
  - Configuration
  - Transformations (SMTs)
- **Auto-refresh**: Toggle auto-refresh (10-second polling)

### Manage Connectors

Use the action buttons to:
- **Pause** - Stop processing without deleting
- **Resume** - Restart a paused connector
- **Restart** - Restart all tasks
- **Delete** - Remove the connector

### Bulk Operations

1. Select multiple connectors (checkbox)
2. Use bulk action buttons:
   - **Pause All** - Pause selected connectors
   - **Resume All** - Resume selected connectors
   - **Restart All** - Restart selected connectors
   - **Delete All** - Delete selected connectors (with confirmation)

---

## 🚢 Kubernetes Deployment (Helm)

**Best for**: Production deployments on Kubernetes/OpenShift

### Quick Install

```bash
# Add helm repository (coming soon)
helm repo add kconnect-console https://mcnabb998.github.io/kconnect-console

# Install with your Kafka Connect URL
helm install kconnect kconnect-console/kconnect-console \
  --set kafkaConnect.url=http://your-kafka-connect:8083 \
  --set ingress.enabled=true \
  --set ingress.host=kconnect.yourcompany.com
```

### Manual Install (Current Method)

Until the Helm chart is published, use these manifests:

**1. Create namespace:**
```bash
kubectl create namespace kconnect-console
```

**2. Create ConfigMap with your settings:**
```bash
kubectl create configmap kconnect-config \
  --from-literal=KAFKA_CONNECT_URL=http://your-kafka-connect:8083 \
  --from-literal=NEXT_PUBLIC_CLUSTER_ID=production \
  --from-literal=ALLOWED_ORIGINS=https://kconnect.yourcompany.com \
  -n kconnect-console
```

**3. Deploy proxy:**
```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kconnect-proxy
  namespace: kconnect-console
spec:
  replicas: 2
  selector:
    matchLabels:
      app: kconnect-proxy
  template:
    metadata:
      labels:
        app: kconnect-proxy
    spec:
      containers:
      - name: proxy
        image: ghcr.io/mcnabb998/kconnect-proxy:latest
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: kconnect-config
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: kconnect-proxy
  namespace: kconnect-console
spec:
  selector:
    app: kconnect-proxy
  ports:
  - port: 8080
    targetPort: 8080
EOF
```

**4. Deploy web UI:**
```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kconnect-web
  namespace: kconnect-console
spec:
  replicas: 2
  selector:
    matchLabels:
      app: kconnect-web
  template:
    metadata:
      labels:
        app: kconnect-web
    spec:
      containers:
      - name: web
        image: ghcr.io/mcnabb998/kconnect-web:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_PROXY_URL
          value: "http://kconnect-proxy:8080"
        - name: NEXT_PUBLIC_CLUSTER_ID
          valueFrom:
            configMapKeyRef:
              name: kconnect-config
              key: NEXT_PUBLIC_CLUSTER_ID
---
apiVersion: v1
kind: Service
metadata:
  name: kconnect-web
  namespace: kconnect-console
spec:
  selector:
    app: kconnect-web
  ports:
  - port: 3000
    targetPort: 3000
EOF
```

**5. Create Ingress (optional):**
```bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kconnect-ingress
  namespace: kconnect-console
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - kconnect.yourcompany.com
    secretName: kconnect-tls
  rules:
  - host: kconnect.yourcompany.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: kconnect-proxy
            port:
              number: 8080
      - path: /
        pathType: Prefix
        backend:
          service:
            name: kconnect-web
            port:
              number: 3000
EOF
```

Access via: `https://kconnect.yourcompany.com`

---

## 🔧 Configuration Options

All configuration is done via environment variables. See `.env.example` for details.

### Key Configuration Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KAFKA_CONNECT_URL` | Kafka Connect REST API endpoint | `http://kafka-connect:8083` |
| `NEXT_PUBLIC_PROXY_URL` | Proxy URL for browser | `http://localhost:8080` |
| `NEXT_PUBLIC_CLUSTER_ID` | Cluster identifier | `default` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `*` |
| `PORT` | Proxy server port | `8080` |

### Example Configurations

**Local Development:**
```env
KAFKA_CONNECT_URL=http://localhost:8083
NEXT_PUBLIC_PROXY_URL=http://localhost:8080
ALLOWED_ORIGINS=*
```

**Production (Kubernetes):**
```env
KAFKA_CONNECT_URL=http://kafka-connect.kafka.svc.cluster.local:8083
NEXT_PUBLIC_PROXY_URL=https://kconnect-api.yourcompany.com
INTERNAL_PROXY_URL=http://kconnect-proxy.default.svc.cluster.local:8080
ALLOWED_ORIGINS=https://kconnect.yourcompany.com
NEXT_PUBLIC_CLUSTER_ID=production-cluster
```

---

## 🚢 Deployment Summary

| Method | Best For | Components | Difficulty |
|--------|----------|------------|------------|
| **Docker Compose (UI only)** | Connecting to existing Kafka Connect | Proxy + Web UI | ⭐ Easy |
| **Docker Compose (Full)** | Local development, testing | All (Kafka stack included) | ⭐ Easy |
| **Kubernetes** | Production, high availability | Proxy + Web UI | ⭐⭐ Medium |
| **Helm Chart** | Production with easy config | Proxy + Web UI | ⭐ Easy (coming soon) |

**Key Point**: kconnect-console is just UI + proxy. Your Kafka Connect cluster runs separately.

---

## ❓ Troubleshooting

### Services Won't Start

**Check Docker is running:**
```bash
docker ps
```

**Check Docker Compose version:**
```bash
docker compose version
# Should be 2.0+
```

**Check logs:**
```bash
cd compose
docker compose logs kconnect-web    # UI logs
docker compose logs kconnect-proxy  # Proxy logs
docker compose logs kafka-connect   # Kafka Connect logs
```

### UI Shows "Connection Error"

**Verify proxy is healthy:**
```bash
curl http://localhost:8080/health
# Should return: {"status":"healthy","kafka_connect":"up"}
```

**Verify Kafka Connect is up:**
```bash
curl http://localhost:8083/
# Should return JSON with version info
```

**Check proxy can reach Kafka Connect:**
```bash
docker compose exec kconnect-proxy sh -c 'curl http://kafka-connect:8083/'
```

### Containers Keep Restarting

**Check resource limits:**
- Docker Desktop: Settings → Resources → Increase memory to 8GB+

**Check port conflicts:**
```bash
# Check if ports are already in use
lsof -i :3000  # Web UI
lsof -i :8080  # Proxy
lsof -i :8083  # Kafka Connect
lsof -i :9092  # Kafka
lsof -i :2181  # Zookeeper
```

**Force recreation:**
```bash
cd compose
docker compose down -v  # Removes volumes
docker compose up -d
```

### Connectors Won't Create

**Verify connector plugin is installed:**
1. Go to **Settings** page
2. Check "Available Connector Plugins" section
3. Look for your connector class (e.g., `io.confluent.connect.jdbc.JdbcSourceConnector`)

**Check Kafka Connect logs:**
```bash
docker compose logs kafka-connect --tail=100
```

**Validate JSON configuration:**
- Use [JSONLint](https://jsonlint.com/) to validate your config
- Check for missing required properties

---

## 📚 Next Steps

### Learn More

- **[Architecture Overview](./README.md#architecture)** - How components work together
- **[Configuration Reference](./.env.example)** - All environment variables explained
- **[Deployment Guide](./DEPLOYMENT.md)** - Kubernetes, EKS, GKE deployments *(coming soon)*
- **[Contributing](./CONTRIBUTING.md)** - Help improve kconnect-console *(coming soon)*

### Explore Features

- **Templates** - Browse pre-configured connector templates
- **Transformations** - View and edit Single Message Transforms (SMTs)
- **Monitoring** - Check cluster health and metrics
- **Bulk Actions** - Manage multiple connectors simultaneously
- **Settings** - View environment details and capabilities

### Get Help

- **GitHub Issues**: [Report bugs or request features](https://github.com/mcnabb998/kconnect-console/issues)
- **Discussions**: [Ask questions](https://github.com/mcnabb998/kconnect-console/discussions)
- **Documentation**: Check README.md and inline help

---

## 🎉 Success!

You're now running kconnect-console! Start by:

1. ✅ Creating a test connector (DataGen Source)
2. ✅ Exploring the UI features
3. ✅ Connecting to your own Kafka Connect cluster
4. ✅ Sharing feedback via GitHub Issues

**Happy connecting! 🚀**
