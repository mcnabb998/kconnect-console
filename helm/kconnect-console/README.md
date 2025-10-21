# kconnect-console Helm Chart

A Helm chart for deploying kconnect-console, a lightweight management UI for Apache Kafka Connect, to Kubernetes.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- An existing Kafka Connect cluster (URL must be accessible from your Kubernetes cluster)

## Installation

### Quick Start

```bash
# Add the repository (if published)
helm repo add kconnect-console https://mcnabb998.github.io/kconnect-console
helm repo update

# Install with your Kafka Connect URL
helm install my-kconnect-console kconnect-console/kconnect-console \
  --set kafkaConnect.url=http://kafka-connect.kafka.svc.cluster.local:8083
```

### Install from Local Chart

```bash
# Clone the repository
git clone https://github.com/mcnabb998/kconnect-console.git
cd kconnect-console

# Install the chart
helm install my-kconnect-console ./helm/kconnect-console \
  --set kafkaConnect.url=http://kafka-connect.kafka.svc.cluster.local:8083
```

### Install with Custom Values

Create a `values.yaml` file:

```yaml
kafkaConnect:
  url: "http://kafka-connect.kafka.svc.cluster.local:8083"

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: kconnect.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kconnect-console-tls
      hosts:
        - kconnect.example.com

proxy:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10

web:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
```

Then install:

```bash
helm install my-kconnect-console ./helm/kconnect-console -f values.yaml
```

## Configuration

The following table lists the configurable parameters of the kconnect-console chart and their default values.

### Global Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `nameOverride` | Override the chart name | `""` |
| `fullnameOverride` | Override the full chart name | `""` |

### Kafka Connect Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `kafkaConnect.url` | **REQUIRED** URL of your existing Kafka Connect cluster | `""` |

**Example URLs:**
- In-cluster: `http://kafka-connect.kafka.svc.cluster.local:8083`
- AWS MSK Connect: `http://your-msk-connect-endpoint.us-east-1.amazonaws.com:8083`
- Confluent Cloud: `http://connect-cluster.yourcompany.com:8083`

### Proxy Service Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `proxy.replicaCount` | Number of proxy replicas | `2` |
| `proxy.image.repository` | Proxy image repository | `ghcr.io/mcnabb998/kconnect-proxy` |
| `proxy.image.tag` | Proxy image tag | `latest` |
| `proxy.image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `proxy.service.type` | Kubernetes service type | `ClusterIP` |
| `proxy.service.port` | Service port | `8080` |
| `proxy.resources.limits.cpu` | CPU limit | `500m` |
| `proxy.resources.limits.memory` | Memory limit | `512Mi` |
| `proxy.resources.requests.cpu` | CPU request | `100m` |
| `proxy.resources.requests.memory` | Memory request | `128Mi` |
| `proxy.autoscaling.enabled` | Enable HPA for proxy | `false` |
| `proxy.autoscaling.minReplicas` | Minimum replicas for HPA | `2` |
| `proxy.autoscaling.maxReplicas` | Maximum replicas for HPA | `10` |
| `proxy.autoscaling.targetCPUUtilizationPercentage` | Target CPU for scaling | `80` |

### Web UI Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `web.replicaCount` | Number of web replicas | `2` |
| `web.image.repository` | Web image repository | `ghcr.io/mcnabb998/kconnect-web` |
| `web.image.tag` | Web image tag | `latest` |
| `web.image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `web.service.type` | Kubernetes service type | `ClusterIP` |
| `web.service.port` | Service port | `3000` |
| `web.resources.limits.cpu` | CPU limit | `500m` |
| `web.resources.limits.memory` | Memory limit | `512Mi` |
| `web.resources.requests.cpu` | CPU request | `100m` |
| `web.resources.requests.memory` | Memory request | `128Mi` |
| `web.autoscaling.enabled` | Enable HPA for web | `false` |
| `web.autoscaling.minReplicas` | Minimum replicas for HPA | `2` |
| `web.autoscaling.maxReplicas` | Maximum replicas for HPA | `10` |

### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `nginx` |
| `ingress.annotations` | Ingress annotations | `{}` |
| `ingress.hosts` | Ingress hosts configuration | See values.yaml |
| `ingress.tls` | Ingress TLS configuration | `[]` |

### Security Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `serviceAccount.create` | Create service account | `true` |
| `serviceAccount.annotations` | Service account annotations | `{}` |
| `serviceAccount.name` | Service account name | `""` |
| `podSecurityContext.runAsNonRoot` | Run as non-root | `true` |
| `podSecurityContext.runAsUser` | User ID | `1000` |
| `podSecurityContext.fsGroup` | File system group | `1000` |
| `securityContext.allowPrivilegeEscalation` | Allow privilege escalation | `false` |
| `securityContext.capabilities.drop` | Drop capabilities | `["ALL"]` |

### Advanced Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `nodeSelector` | Node selector for pod assignment | `{}` |
| `tolerations` | Tolerations for pod assignment | `[]` |
| `affinity` | Affinity rules | Pod anti-affinity enabled |
| `imagePullSecrets` | Image pull secrets | `[]` |

## Examples

### Production Deployment with High Availability

```yaml
kafkaConnect:
  url: "http://kafka-connect.production.svc.cluster.local:8083"

proxy:
  replicaCount: 3
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 20
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
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
    targetMemoryUtilizationPercentage: 80
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 250m
      memory: 256Mi

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  hosts:
    - host: kafka-connect.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kconnect-console-tls
      hosts:
        - kafka-connect.example.com

affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
            - key: app.kubernetes.io/name
              operator: In
              values:
                - kconnect-console
        topologyKey: kubernetes.io/hostname
```

### Development/Testing Deployment

```yaml
kafkaConnect:
  url: "http://kafka-connect.dev.svc.cluster.local:8083"

proxy:
  replicaCount: 1
  resources:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 50m
      memory: 64Mi

web:
  replicaCount: 1
  resources:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 50m
      memory: 64Mi
```

### AWS MSK Connect

```yaml
kafkaConnect:
  url: "http://my-msk-connect-cluster.us-east-1.amazonaws.com:8083"

proxy:
  replicaCount: 2

web:
  replicaCount: 2

ingress:
  enabled: true
  className: alb
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:123456789:certificate/xxx
  hosts:
    - host: kconnect.example.com
      paths:
        - path: /
          pathType: Prefix
```

## Uninstalling the Chart

```bash
helm uninstall my-kconnect-console
```

This removes all the Kubernetes components associated with the chart and deletes the release.

## Upgrading the Chart

```bash
# Update your values.yaml if needed, then:
helm upgrade my-kconnect-console ./helm/kconnect-console -f values.yaml

# Or update specific values:
helm upgrade my-kconnect-console ./helm/kconnect-console \
  --set proxy.replicaCount=3
```

## Troubleshooting

### Check deployment status

```bash
kubectl get pods -l app.kubernetes.io/instance=my-kconnect-console
```

### View logs

```bash
# Proxy logs
kubectl logs -l app.kubernetes.io/component=proxy

# Web logs
kubectl logs -l app.kubernetes.io/component=web
```

### Test connectivity to Kafka Connect

```bash
# Port forward the proxy
kubectl port-forward svc/my-kconnect-console-proxy 8080:8080

# Check health
curl http://localhost:8080/health

# List connectors
curl http://localhost:8080/api/default/connectors
```

### Common Issues

1. **Cannot connect to Kafka Connect**
   - Verify the `kafkaConnect.url` is correct and accessible from the cluster
   - Check proxy logs: `kubectl logs -l app.kubernetes.io/component=proxy`
   - Test connectivity from a pod: `kubectl run -it --rm debug --image=curlimages/curl -- curl <kafka-connect-url>`

2. **Pods not starting**
   - Check resource limits: `kubectl describe pod <pod-name>`
   - Verify image pull: `kubectl get events`

3. **Ingress not working**
   - Verify ingress controller is installed
   - Check ingress status: `kubectl get ingress`
   - Review ingress controller logs

## Support

- GitHub: https://github.com/mcnabb998/kconnect-console
- Issues: https://github.com/mcnabb998/kconnect-console/issues
- Documentation: https://github.com/mcnabb998/kconnect-console/blob/main/GETTING_STARTED.md
