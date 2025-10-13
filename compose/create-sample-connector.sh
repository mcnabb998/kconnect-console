#!/bin/bash

# Script to create a sample datagen connector for testing

PROXY_URL="${PROXY_URL:-http://localhost:8080}"
CLUSTER="${CLUSTER:-default}"

echo "Creating sample datagen connector..."
echo "Proxy URL: $PROXY_URL"
echo "Cluster: $CLUSTER"
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST "$PROXY_URL/api/$CLUSTER/connectors" \
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
      "tasks.max": "1",
      "database.password": "supersecret123",
      "api.key": "my-secret-api-key"
    }
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

echo "HTTP Status: $http_code"
echo ""
echo "Response:"
echo "$body" | jq . 2>/dev/null || echo "$body"
echo ""

if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
  echo "✓ Connector created successfully!"
  echo ""
  echo "Note: Check the response above - sensitive fields like 'database.password'"
  echo "and 'api.key' should be redacted as '***REDACTED***'"
else
  echo "✗ Failed to create connector"
  exit 1
fi
