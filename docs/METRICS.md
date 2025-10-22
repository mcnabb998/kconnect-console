# Connector Metrics and Performance Monitoring

## Overview

kconnect-console provides real-time performance monitoring for Kafka Connect connectors through JMX metrics exposed via Jolokia. This feature gives you visibility into:

- **Throughput**: Records and bytes processed per second
- **Errors**: Total errors, error rates, and recent failures
- **Task Performance**: Per-task metrics and status
- **Historical Trends**: Recent performance trends with visual indicators

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   Browser   │────▶│   Go Proxy   │────▶│ Kafka Connect  │
│  (Metrics   │     │  (Metrics    │     │   (Port 8083)  │
│   UI)       │     │   Endpoint)  │     └────────┬───────┘
└─────────────┘     └──────────────┘              │
                                                   │ JMX
                                          ┌────────▼────────┐
                                          │    Jolokia      │
                                          │  (Port 8778)    │
                                          └─────────────────┘
```

## Setup

### 1. Enable Jolokia on Kafka Connect

The docker-compose configuration automatically installs and configures Jolokia:

```yaml
environment:
  KAFKA_JMX_OPTS: "-javaagent:/opt/jolokia-jvm-agent.jar=port=8778,host=0.0.0.0"
ports:
  - "8778:8778"  # Jolokia JMX metrics
```

### 2. Configure Proxy

Set the Jolokia URL in the proxy environment:

```bash
JOLOKIA_URL=http://kafka-connect:8778/jolokia
```

### 3. Access Metrics

Metrics are available through:

1. **Connector Detail Page**: Navigate to any connector and click the "Metrics" tab
2. **API Endpoint**: `GET /api/{cluster}/connectors/{name}/metrics`

## Metrics Collected

### Throughput Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| Records/sec | Records processed per second | records/s |
| Bytes/sec | Bytes processed per second | bytes/s |
| Total Records | Cumulative records processed | count |
| Total Bytes | Cumulative bytes processed | bytes |

### Error Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| Total Errors | Cumulative error count | count |
| Error Rate | Percentage of operations that failed | % |
| Recent Errors | Errors in recent collection window | count |

### Task Metrics

Per-task breakdown showing:
- Task ID and state (RUNNING, FAILED, etc.)
- Records processed by each task
- Bytes processed by each task
- Errors encountered by each task

## API Reference

### Get Connector Metrics

```http
GET /api/{cluster}/connectors/{name}/metrics
```

**Response:**

```json
{
  "connectorName": "datagen-users",
  "throughput": {
    "recordsPerSecond": 125.5,
    "bytesPerSecond": 15680,
    "totalRecords": 1500000,
    "totalBytes": 188160000
  },
  "errors": {
    "totalErrors": 5,
    "errorRate": 0.00033,
    "recentErrorCount": 0
  },
  "resources": {
    "cpuPercent": 0,
    "memoryUsedMB": 0,
    "memoryTotalMB": 0,
    "threadCount": 0
  },
  "tasks": [
    {
      "taskId": 0,
      "recordsProcessed": 750000,
      "bytesProcessed": 94080000,
      "errorCount": 2,
      "state": "RUNNING"
    },
    {
      "taskId": 1,
      "recordsProcessed": 750000,
      "bytesProcessed": 94080000,
      "errorCount": 3,
      "state": "RUNNING"
    }
  ],
  "lastUpdated": "2025-10-22T05:30:15.123Z",
  "collectionDuration": 150000000
}
```

### Error Responses

**Connector Not Found (500):**
```json
{
  "error": "metrics_fetch_failed",
  "message": "unexpected status fetching connector test: 404"
}
```

**Kafka Connect Unavailable (503):**
```json
{
  "error": "metrics_fetch_failed",
  "message": "kafka connect is unreachable: connection refused"
}
```

## Caching

Metrics are cached for **5 seconds** to reduce load on Kafka Connect and Jolokia. This means:

- Multiple requests within 5 seconds return cached data
- Fresh data is fetched automatically after cache expiration
- Cache is per-connector (different connectors have independent caches)

## Performance Considerations

### JMX Metric Collection

JMX metrics are collected per-task through Jolokia. The following MBeans are queried:

```
kafka.connect:type=connector-task-metrics,connector="{connector}",task="{task}"
```

**Attributes queried:**
- `source-record-poll-total`: Total records polled
- `source-record-write-total`: Total records written
- `total-errors-logged`: Total errors logged

### Graceful Degradation

If Jolokia is unavailable or returns errors:
- The metrics endpoint still returns successfully
- Metrics default to zero or empty values
- Task information is populated from Kafka Connect status API
- Error message is displayed in the UI with helpful guidance

## UI Components

### MetricsCard Component

Real-time metrics display with:
- Auto-refresh every 5 seconds
- Visual metric boxes with icons
- Color-coded alerts (green = good, yellow = warning, red = error)
- Task breakdown table
- Trend indicators comparing current vs. previous values

**Props:**
```typescript
interface MetricsCardProps {
  connectorName: string;
  refreshInterval?: number; // milliseconds, default 5000
}
```

### Trend Indicators

Simple visual indicators show performance trends:
- ↗ Good: Metric is improving (more throughput, fewer errors)
- ↘ Alert: Metric is degrading
- → Stable: No significant change

## Troubleshooting

### Metrics show zero values

**Possible causes:**
1. Jolokia is not installed or not running
2. JMX metrics are not enabled on Kafka Connect
3. Connector has no activity yet

**Solutions:**
1. Verify Jolokia is running: `curl http://localhost:8778/jolokia/version`
2. Check KAFKA_JMX_OPTS is set in docker-compose
3. Create activity by starting the connector and processing data

### "Metrics Unavailable" warning

This indicates the metrics endpoint returned an error. Common causes:

1. **Jolokia not configured**: Install Jolokia agent (done automatically in docker-compose)
2. **Network connectivity**: Ensure proxy can reach Jolokia URL
3. **Permissions**: JMX may require authentication in production

### High error rates

If metrics show high error rates:

1. Check connector logs for detailed error messages
2. Review connector configuration
3. Verify source/sink systems are accessible
4. Check for schema compatibility issues

## Limitations

### Current Implementation

- **JMX-only metrics**: Currently fetches basic JMX metrics available through Jolokia
- **No CPU/Memory**: Resource metrics (CPU, memory) are placeholders for future implementation
- **No lag metrics**: Consumer lag metrics require additional Kafka broker integration
- **Task-level only**: Connector-level aggregations are computed from task metrics

### Future Enhancements

Planned improvements:
- [ ] Resource usage (CPU, memory) via Java management beans
- [ ] Consumer lag metrics for source connectors
- [ ] Historical data retention and charting
- [ ] Performance alerts and thresholds
- [ ] Export metrics to Prometheus/monitoring systems

## Production Deployment

### Security

In production environments:

1. **Restrict Jolokia access**: Use firewall rules or network policies
2. **Enable authentication**: Configure Jolokia with username/password
3. **Use HTTPS**: Enable TLS for Jolokia endpoints
4. **Limit JMX exposure**: Only expose necessary MBeans

Example secured configuration:

```yaml
environment:
  KAFKA_JMX_OPTS: >-
    -javaagent:/opt/jolokia-jvm-agent.jar=
    port=8778,
    host=0.0.0.0,
    user=admin,
    password=${JOLOKIA_PASSWORD},
    protocol=https,
    useSslClientAuthentication=false
```

### Monitoring at Scale

For large deployments:

1. **Increase cache TTL**: Adjust `metricsCacheTTL` in proxy if needed
2. **Use connection pooling**: HTTP client already reuses connections
3. **Monitor proxy performance**: Track metrics endpoint latency
4. **Consider sampling**: Not all connectors need real-time metrics

### High Availability

The metrics endpoint is stateless and scales horizontally:

- Multiple proxy instances can run in parallel
- Each instance maintains its own cache
- No shared state between instances
- Load balancer can distribute requests

## Examples

### Fetching Metrics via CLI

```bash
# Get metrics for a specific connector
curl http://localhost:8080/api/default/connectors/datagen-users/metrics | jq

# Monitor error rate
curl -s http://localhost:8080/api/default/connectors/datagen-users/metrics \
  | jq '.errors.errorRate'

# Check throughput
curl -s http://localhost:8080/api/default/connectors/datagen-users/metrics \
  | jq '.throughput.recordsPerSecond'
```

### TypeScript Usage

```typescript
import { fetchConnectorMetrics } from '@/lib/api';

// Fetch metrics
const metrics = await fetchConnectorMetrics('datagen-users');

// Check if connector is healthy
if (metrics.errors.errorRate > 5) {
  console.warn('High error rate detected:', metrics.errors.errorRate);
}

// Display throughput
console.log(`Throughput: ${metrics.throughput.recordsPerSecond} records/sec`);
```

## References

- [Jolokia Documentation](https://jolokia.org/reference/html/)
- [Kafka Connect JMX Metrics](https://docs.confluent.io/platform/current/connect/monitoring.html)
- [JMX Best Practices](https://docs.oracle.com/javase/8/docs/technotes/guides/management/best-practices.html)
