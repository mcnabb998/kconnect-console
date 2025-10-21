# Helm Installation Guide

This guide provides quick installation instructions for deploying kconnect-console using Helm.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- An existing Kafka Connect cluster accessible from your Kubernetes cluster

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/mcnabb998/kconnect-console.git
cd kconnect-console
```

### 2. Basic Installation

```bash
helm install my-kconnect-console ./helm/kconnect-console \
  --set kafkaConnect.url=http://kafka-connect.kafka.svc.cluster.local:8083
```

### 3. Access the UI

```bash
# Port forward to access the UI
kubectl port-forward svc/my-kconnect-console-web 3000:3000

# Open in browser: http://localhost:3000
```

## Common Configurations

### With Ingress

```bash
helm install my-kconnect-console ./helm/kconnect-console \
  --set kafkaConnect.url=http://kafka-connect.kafka.svc.cluster.local:8083 \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=kconnect.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

### With Autoscaling

```bash
helm install my-kconnect-console ./helm/kconnect-console \
  --set kafkaConnect.url=http://kafka-connect.kafka.svc.cluster.local:8083 \
  --set proxy.autoscaling.enabled=true \
  --set proxy.autoscaling.minReplicas=2 \
  --set proxy.autoscaling.maxReplicas=10 \
  --set web.autoscaling.enabled=true \
  --set web.autoscaling.minReplicas=2 \
  --set web.autoscaling.maxReplicas=10
```

### Production Setup (values.yaml)

Create a `values.yaml` file:

```yaml
kafkaConnect:
  url: "http://kafka-connect.production.svc.cluster.local:8083"

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: kconnect.yourcompany.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kconnect-console-tls
      hosts:
        - kconnect.yourcompany.com

proxy:
  replicaCount: 3
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 20
    targetCPUUtilizationPercentage: 70
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 250m
      memory: 256Mi

web:
  replicaCount: 3
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 20
    targetCPUUtilizationPercentage: 70
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 250m
      memory: 256Mi
```

Then install:

```bash
helm install my-kconnect-console ./helm/kconnect-console -f values.yaml
```

## Verify Installation

```bash
# Check pods
kubectl get pods -l app.kubernetes.io/instance=my-kconnect-console

# Check services
kubectl get svc -l app.kubernetes.io/instance=my-kconnect-console

# Test proxy health
kubectl port-forward svc/my-kconnect-console-proxy 8080:8080
curl http://localhost:8080/health
```

## Upgrade

```bash
helm upgrade my-kconnect-console ./helm/kconnect-console -f values.yaml
```

## Uninstall

```bash
helm uninstall my-kconnect-console
```

## Full Documentation

For complete configuration options and examples, see:
- [Helm Chart README](kconnect-console/README.md)
- [Getting Started Guide](../GETTING_STARTED.md)
