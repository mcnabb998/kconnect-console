# Audit Logging

kconnect-console provides comprehensive audit logging to track all connector operations and configuration changes. This is essential for compliance requirements and team collaboration in production environments.

## Features

### Automatic Tracking
All connector operations are automatically logged:
- **CREATE** - New connector creation
- **UPDATE** - Configuration changes
- **DELETE** - Connector deletion
- **PAUSE** - Connector pause operations
- **RESUME** - Connector resume operations
- **RESTART** - Connector restart operations

### Captured Information
Each audit log entry includes:
- **Timestamp** - When the operation occurred (RFC3339 format)
- **Action** - The type of operation performed
- **Connector Name** - Which connector was affected
- **Status** - SUCCESS or FAILED
- **Source IP** - Client IP address (supports X-Forwarded-For)
- **Configuration Changes** - Config diffs for CREATE/UPDATE operations
- **Error Messages** - Detailed error information for failed operations

### Security Features
- **Credential Redaction** - Sensitive values (passwords, secrets, tokens) are automatically redacted in audit logs
- **Safe Storage** - In-memory storage with configurable size limits (default: 10,000 entries)
- **Read-Only Access** - Audit logs cannot be modified or deleted through the API

## API Usage

### Retrieve Audit Logs

```bash
# Get all audit logs (limited to 1000 by default)
curl http://localhost:8080/api/default/audit-logs

# Filter by connector name
curl http://localhost:8080/api/default/audit-logs?connector=my-connector

# Filter by action type
curl http://localhost:8080/api/default/audit-logs?action=CREATE

# Filter by status
curl http://localhost:8080/api/default/audit-logs?status=FAILED

# Combine multiple filters
curl http://localhost:8080/api/default/audit-logs?connector=my-connector&action=UPDATE&status=SUCCESS

# Set custom limit
curl http://localhost:8080/api/default/audit-logs?limit=50

# Filter by time range (RFC3339 format)
curl http://localhost:8080/api/default/audit-logs?since=2024-01-01T00:00:00Z&until=2024-12-31T23:59:59Z
```

### Response Format

```json
{
  "entries": [
    {
      "id": "20241001120000.000000-my-connector-CREATE",
      "timestamp": "2024-10-01T12:00:00Z",
      "action": "CREATE",
      "connectorName": "my-connector",
      "sourceIp": "192.168.1.100",
      "status": "SUCCESS",
      "changes": {
        "connector.class": "io.confluent.connect.jdbc.JdbcSourceConnector",
        "tasks.max": "1",
        "connection.url": "***REDACTED***",
        "connection.user": "admin"
      }
    }
  ],
  "total": 1
}
```

## Web UI Usage

### Accessing Audit Logs

1. Navigate to the **Audit Logs** page in the left sidebar
2. The page displays all connector operations in a sortable table

### Filtering Logs

Use the filter panel to narrow down results:
- **Connector Name** - Filter by specific connector (text search)
- **Action** - Select operation type (CREATE, UPDATE, DELETE, etc.)
- **Status** - Filter by SUCCESS or FAILED
- **Limit** - Control number of results displayed (1-10000)

Click **Apply Filters** to refresh the view with your criteria.

### Viewing Details

Click the **View** button on any audit log entry to see:
- Full timestamp with timezone
- Complete configuration changes (if applicable)
- Error messages for failed operations
- Source IP address
- Unique audit log ID

### Exporting Logs

Export audit logs for external analysis or archival:

1. **CSV Export** - Click "Export CSV" to download in spreadsheet format
   - Includes: Timestamp, Action, Connector, Status, Source IP, Error Message
   
2. **JSON Export** - Click "Export JSON" to download raw data
   - Includes: All fields including configuration changes
   - Suitable for programmatic processing

Exported files are named with the current timestamp: `audit-logs-2024-10-01T12:00:00.000Z.csv`

## Configuration

### Storage Capacity

The audit logger stores up to 10,000 entries by default. Older entries are automatically removed when this limit is reached. To modify the limit, update the `auditLogger` initialization in `proxy/main.go`:

```go
auditLogger = NewAuditLogger(10000) // Change to desired capacity
```

### Retention Policy

Currently, audit logs are stored in-memory and are cleared when the proxy service restarts. For production environments requiring persistent storage, consider:

1. **External Logging** - Forward logs to a centralized logging system (Splunk, ELK, etc.)
2. **Periodic Export** - Use the export API to backup logs regularly
3. **Database Integration** - Modify the audit logger to use persistent storage

## Integration Examples

### Monitoring Failed Operations

```bash
# Check for recent failures
curl "http://localhost:8080/api/default/audit-logs?status=FAILED&limit=10" | jq '.entries'
```

### Tracking Configuration Changes

```bash
# View all UPDATE operations for a connector
curl "http://localhost:8080/api/default/audit-logs?connector=my-connector&action=UPDATE" | jq '.entries[] | {timestamp, changes}'
```

### Compliance Reporting

```bash
# Get all operations in a time range
curl "http://localhost:8080/api/default/audit-logs?since=2024-10-01T00:00:00Z&until=2024-10-31T23:59:59Z" | jq '.entries | length'
```

## Best Practices

1. **Regular Exports** - Backup audit logs periodically using the export feature
2. **Filter First** - Use filters to reduce data volume when exporting or analyzing
3. **Monitor Failures** - Set up alerts for failed operations using the status filter
4. **IP Tracking** - Use source IP information for security auditing
5. **Configuration Reviews** - Review configuration diffs for sensitive data exposure

## Limitations

- **In-Memory Storage** - Logs are lost on service restart
- **No Authentication** - Audit logs do not track user identity (relies on IP addresses)
- **Fixed Retention** - Limited to configured max size
- **No Modification** - Past audit entries cannot be edited or deleted

## Future Enhancements

Potential improvements for audit logging:
- Persistent storage (database backend)
- User authentication integration
- Configurable retention policies
- Advanced search capabilities
- Webhook notifications for specific events
- Integration with external SIEM systems
