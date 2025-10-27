package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAuditLogHandler(t *testing.T) {
	// Reset audit logger
	auditLogger = NewAuditLogger(100)

	// Add some test entries
	entries := []AuditLogEntry{
		{
			Action:        "CREATE",
			ConnectorName: "test-connector-1",
			SourceIP:      "192.168.1.1",
			Status:        "SUCCESS",
			Timestamp:     time.Now().Add(-2 * time.Hour),
		},
		{
			Action:        "DELETE",
			ConnectorName: "test-connector-1",
			SourceIP:      "192.168.1.2",
			Status:        "SUCCESS",
			Timestamp:     time.Now().Add(-1 * time.Hour),
		},
		{
			Action:        "CREATE",
			ConnectorName: "test-connector-2",
			SourceIP:      "192.168.1.1",
			Status:        "FAILED",
			ErrorMessage:  "Invalid config",
			Timestamp:     time.Now().Add(-30 * time.Minute),
		},
	}

	for _, entry := range entries {
		auditLogger.Log(entry)
	}

	tests := []struct {
		name           string
		query          string
		expectedCount  int
		expectedStatus int
	}{
		{
			name:           "Get all entries",
			query:          "",
			expectedCount:  3,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Filter by connector",
			query:          "?connector=test-connector-1",
			expectedCount:  2,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Filter by action",
			query:          "?action=CREATE",
			expectedCount:  2,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Filter by status",
			query:          "?status=FAILED",
			expectedCount:  1,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Filter with limit",
			query:          "?limit=2",
			expectedCount:  2,
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/default/audit-logs"+tt.query, nil)
			w := httptest.NewRecorder()

			auditLogHandler(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			var response map[string]interface{}
			if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			entries, ok := response["entries"].([]interface{})
			if !ok {
				t.Fatal("Expected entries array in response")
			}

			if len(entries) != tt.expectedCount {
				t.Errorf("Expected %d entries, got %d", tt.expectedCount, len(entries))
			}
		})
	}
}

func TestDetectConnectorOperation(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		path           string
		body           string
		expectedName   string
		expectedAction string
	}{
		{
			name:           "Create connector",
			method:         "POST",
			path:           "/api/default/connectors",
			body:           `{"name":"test-connector","config":{}}`,
			expectedName:   "test-connector",
			expectedAction: "CREATE",
		},
		{
			name:           "Update connector config",
			method:         "PUT",
			path:           "/api/default/connectors/test-connector",
			body:           `{"config":{}}`,
			expectedName:   "test-connector",
			expectedAction: "UPDATE",
		},
		{
			name:           "Delete connector",
			method:         "DELETE",
			path:           "/api/default/connectors/test-connector",
			body:           "",
			expectedName:   "test-connector",
			expectedAction: "DELETE",
		},
		{
			name:           "Pause connector",
			method:         "PUT",
			path:           "/api/default/connectors/test-connector/pause",
			body:           "",
			expectedName:   "test-connector",
			expectedAction: "PAUSE",
		},
		{
			name:           "Resume connector",
			method:         "PUT",
			path:           "/api/default/connectors/test-connector/resume",
			body:           "",
			expectedName:   "test-connector",
			expectedAction: "RESUME",
		},
		{
			name:           "Restart connector",
			method:         "POST",
			path:           "/api/default/connectors/test-connector/restart",
			body:           "",
			expectedName:   "test-connector",
			expectedAction: "RESTART",
		},
		{
			name:           "Update connector config via config endpoint",
			method:         "PUT",
			path:           "/api/default/connectors/test-connector/config",
			body:           `{"connector.class":"io.confluent.connect.jdbc.JdbcSourceConnector"}`,
			expectedName:   "test-connector",
			expectedAction: "UPDATE",
		},
		{
			name:           "Non-connector operation",
			method:         "GET",
			path:           "/api/default/cluster",
			body:           "",
			expectedName:   "",
			expectedAction: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, bytes.NewBufferString(tt.body))
			bodyBytes := []byte(tt.body)

			name, action := detectConnectorOperation(req, bodyBytes)

			if name != tt.expectedName {
				t.Errorf("Expected connector name %q, got %q", tt.expectedName, name)
			}

			if action != tt.expectedAction {
				t.Errorf("Expected action %q, got %q", tt.expectedAction, action)
			}
		})
	}
}

func TestExtractClientIP(t *testing.T) {
	tests := []struct {
		name       string
		headers    map[string]string
		remoteAddr string
		expectedIP string
	}{
		{
			name:       "X-Forwarded-For header",
			headers:    map[string]string{"X-Forwarded-For": "203.0.113.1, 198.51.100.1"},
			remoteAddr: "192.168.1.1:12345",
			expectedIP: "203.0.113.1",
		},
		{
			name:       "X-Real-IP header",
			headers:    map[string]string{"X-Real-IP": "203.0.113.1"},
			remoteAddr: "192.168.1.1:12345",
			expectedIP: "203.0.113.1",
		},
		{
			name:       "RemoteAddr only",
			headers:    map[string]string{},
			remoteAddr: "192.168.1.1:12345",
			expectedIP: "192.168.1.1",
		},
		{
			name:       "RemoteAddr without port",
			headers:    map[string]string{},
			remoteAddr: "192.168.1.1",
			expectedIP: "192.168.1.1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			for key, value := range tt.headers {
				req.Header.Set(key, value)
			}
			req.RemoteAddr = tt.remoteAddr

			ip := extractClientIP(req)

			if ip != tt.expectedIP {
				t.Errorf("Expected IP %q, got %q", tt.expectedIP, ip)
			}
		})
	}
}

func TestExtractChangesFromBody(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		expected bool
	}{
		{
			name:     "Valid config",
			body:     `{"name":"test","config":{"connector.class":"TestConnector","tasks.max":"1"}}`,
			expected: true,
		},
		{
			name:     "Empty body",
			body:     "",
			expected: false,
		},
		{
			name:     "Invalid JSON",
			body:     `{invalid}`,
			expected: false,
		},
		{
			name:     "No config field",
			body:     `{"name":"test"}`,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			changes := extractChangesFromBody([]byte(tt.body))

			hasChanges := changes != nil
			if hasChanges != tt.expected {
				t.Errorf("Expected hasChanges=%v, got %v", tt.expected, hasChanges)
			}
		})
	}
}
