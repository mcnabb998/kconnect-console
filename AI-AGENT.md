# AI Agent Development Guide

## 🤖 Guide for AI Agents Working on Kafka Connect Console

This document provides essential information for AI agents making changes to the Kafka Connect Console codebase. Read this **BEFORE** making any modifications.

---

## 📁 Project Architecture

### Core Components

```
kconnect-console/
├── compose/                 # Docker infrastructure
│   ├── docker-compose.yml  # Service definitions
│   └── create-sample-connector.sh
├── proxy/                   # Go-based API proxy
│   ├── main.go             # Core proxy logic
│   ├── Dockerfile
│   └── go.mod
├── web/                     # Next.js web UI
│   ├── app/                # Next.js 13+ app router
│   ├── Dockerfile
│   └── package.json
└── AI-AGENT.md             # This file
```

### Service Dependencies
```
Web UI (Next.js) → Proxy (Go) → Kafka Connect → Kafka ← Zookeeper
     :3000           :8080        :8083         :9092     :2181
```

---

## 🔧 Critical System Components

### 1. Kafka Listeners Configuration ⚠️ **CRITICAL**

**Current Working Configuration:**
```yaml
# compose/docker-compose.yml
KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,PLAINTEXT_HOST://0.0.0.0:29092
KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092
CONNECT_BOOTSTRAP_SERVERS: 'kafka:9092'  # Must use 9092, NOT 29092
```

**❌ DO NOT:**
- Change Kafka Connect to use `kafka:29092`
- Remove the `KAFKA_LISTENERS` configuration
- Modify port mappings without understanding the internal/external access patterns

**✅ UNDERSTAND:**
- Port 9092: Internal container communication
- Port 29092: Host access (optional, for debugging)
- Kafka Connect MUST use internal port (9092)

### 2. Proxy URL Routing Logic ⚠️ **COMPLEX**

**Current Working Logic:**
```go
// proxy/main.go - proxyHandler function
if path == "" {
    // /api/default/connectors → /connectors
    // /api/default/connector-plugins → /connector-plugins
} else {
    // /api/default/connectors/name → /connectors/name
    // /api/default/connectors/name/status → /connectors/name/status
}
```

**❌ DO NOT:**
- Simplify the URL routing without thorough testing
- Remove the path parsing logic
- Break the connector-plugins endpoints

**✅ TEST ENDPOINTS:**
- `GET /api/default/connectors` → Returns connector list
- `GET /api/default/connector-plugins` → Returns available plugins
- `GET /api/default/connectors/{name}` → Returns connector config
- `GET /api/default/connectors/{name}/status` → Returns connector status

### 3. Sensitive Data Redaction ⚠️ **SECURITY CRITICAL**

**Current Working Pattern:**
```go
sensitivePattern = regexp.MustCompile(`(?i)(^|[._-])(password|secret|api[._-]?key|access[._-]?key|secret[._-]?key|token|credential(s)?)([._-]|$)`)
safeExactKeys = map[string]struct{}{
    "key.converter": {},
    "value.converter": {},
    "internal.key.converter": {},
    "internal.value.converter": {},
}
```

**❌ DO NOT:**
- Make the pattern too broad (breaks legitimate config)
- Make the pattern too narrow (leaks secrets)
- Remove the safe keys allowlist

**✅ TEST REDACTION:**
```bash
# Should be redacted:
"database.password": "***REDACTED***"
"api.key": "***REDACTED***"
"secret.token": "***REDACTED***"

# Should NOT be redacted:
"key.converter": "org.apache.kafka.connect.storage.StringConverter"
"value.converter": "org.apache.kafka.connect.json.JsonConverter"
```

### 4. HTTP Method Routing ⚠️ **API COMPATIBILITY**

**Current Working Logic:**
```typescript
// web/app/connectors/[name]/page.tsx
const method = action === 'restart' ? 'POST' : 'PUT';
```

**❌ DO NOT:**
- Use PUT for restart operations (Kafka Connect expects POST)
- Change other operations to POST without verification

**✅ KAFKA CONNECT API:**
- `POST /connectors/{name}/restart` ✓
- `PUT /connectors/{name}/pause` ✓  
- `PUT /connectors/{name}/resume` ✓

---

## 🧪 Testing Requirements

### Before Making Changes
1. **Start services:** `docker compose up -d`
2. **Verify health:** All containers running and healthy
3. **Test endpoints:** Basic API calls work

### After Making Changes
1. **Rebuild affected services:** `docker compose build [service]`
2. **Restart services:** `docker compose up -d`
3. **Test core functionality:**
   ```bash
   # Test basic endpoints
   curl http://localhost:8080/api/default/connectors
   curl http://localhost:8080/api/default/connector-plugins
   
   # Test UI
   # Open http://localhost:3000
   
   # Create test connector
   ./create-sample-connector.sh
   
   # Test redaction
   curl http://localhost:8080/api/default/connectors/[name]
   ```

### Critical Test Cases
- [ ] Services start without errors
- [ ] Kafka Connect connects to Kafka (check logs)
- [ ] Web UI loads and shows connectors
- [ ] Connector operations work (pause/resume/restart/delete)
- [ ] Sensitive data is redacted
- [ ] Legitimate config fields are preserved
- [ ] New connector-plugins endpoint works

---

## 🚫 Common Pitfalls

### 1. **Port Confusion**
- **Problem:** Using wrong ports between services
- **Solution:** Always use internal Docker network names and ports
- **Example:** `kafka:9092` NOT `localhost:9092` for internal communication

### 2. **URL Routing Bugs**
- **Problem:** Proxy routes to wrong Kafka Connect endpoints
- **Solution:** Test all endpoint variations after routing changes
- **Debug:** Check proxy logs for actual forwarded URLs

### 3. **Over-broad Redaction**
- **Problem:** Redacting legitimate configuration fields
- **Solution:** Always test with real connector configs
- **Verify:** `key.converter` and `value.converter` should NOT be redacted

### 4. **Environment Variable Scope**
- **Problem:** Environment variables not propagating to containers
- **Solution:** Understand Docker Compose variable precedence
- **Note:** `NEXT_PUBLIC_*` variables are build-time, not runtime

### 5. **Signal Handling**
- **Problem:** Containers don't shut down cleanly
- **Solution:** Use `exec` for foreground processes, not background + sleep

---

## 🔧 Development Workflow

### Making Safe Changes

1. **Read this guide completely**
2. **Understand the component you're modifying**
3. **Make incremental changes**
4. **Test after each change**
5. **Document breaking changes**

### Emergency Rollback
```bash
git checkout HEAD~1 -- [changed-files]
docker compose down
docker compose build
docker compose up -d
```

### Adding New Features

1. **Follow existing patterns**
2. **Add appropriate error handling**
3. **Update environment variable documentation**
4. **Add to test scenarios**
5. **Update this guide if architecture changes**

---

## 📋 Change Checklist

Before committing any changes, verify:

### Infrastructure Changes (docker-compose.yml)
- [ ] All services still start successfully
- [ ] Inter-service communication works
- [ ] Port mappings are correct
- [ ] Environment variables are properly configured

### Proxy Changes (proxy/main.go)
- [ ] URL routing works for all endpoints
- [ ] CORS headers are preserved
- [ ] Sensitive data redaction functions correctly
- [ ] Error handling is appropriate
- [ ] Logs are helpful for debugging

### Web UI Changes (web/app/)
- [ ] UI loads without errors
- [ ] API calls use correct endpoints
- [ ] Environment variables are used consistently
- [ ] User interactions work as expected
- [ ] Error messages are user-friendly

### Security Considerations
- [ ] Sensitive data is properly redacted
- [ ] No secrets in logs or responses
- [ ] CORS is configured appropriately
- [ ] Input validation is in place

---

## 🆘 Troubleshooting

### Services Won't Start
1. Check `docker compose logs [service]`
2. Verify port conflicts: `docker compose ps`
3. Check environment variables
4. Verify Dockerfile syntax

### Kafka Connect Won't Connect
1. Check Kafka listener configuration
2. Verify bootstrap server setting
3. Check network connectivity: `docker compose exec kafka-connect ping kafka`
4. Review kafka and kafka-connect logs

### Proxy Routing Issues
1. Check proxy logs for forwarded URLs
2. Test direct Kafka Connect API: `curl http://localhost:8083/connectors`
3. Verify path parsing logic
4. Check for URL encoding issues

### Web UI Issues
1. Check browser console for errors
2. Verify API endpoints in Network tab
3. Check if proxy URL is correct
4. Test API directly before UI

---

## 📚 Additional Resources

### Kafka Connect API Documentation
- [Confluent Kafka Connect REST API](https://docs.confluent.io/platform/current/connect/references/restapi.html)

### Docker Compose Best Practices
- [Docker Compose Networking](https://docs.docker.com/compose/networking/)

### Next.js Environment Variables
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

---

## 🤝 Contributing

When making changes as an AI agent:

1. **Be Conservative:** Prefer small, incremental changes
2. **Test Thoroughly:** Every change should be verified
3. **Document:** Update this guide if you learn something new
4. **Communicate:** Explain your reasoning in commit messages

**Remember:** This system has many interdependencies. A small change in one component can break others. Always test the entire system after modifications.

---

*Last Updated: October 12, 2025*
*Version: 1.0 - Initial release after critical fixes*