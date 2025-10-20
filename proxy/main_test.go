package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"

	"github.com/mcnabb998/kconnect-console/proxy/testutils"
)

func TestRedactSensitiveData(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected interface{}
	}{
		{
			name: "Simple password field",
			input: map[string]interface{}{
				"username": "admin",
				"password": "secret123",
			},
			expected: map[string]interface{}{
				"username": "admin",
				"password": "***REDACTED***",
			},
		},
		{
			name: "Nested secret field",
			input: map[string]interface{}{
				"config": map[string]interface{}{
					"database.user":     "admin",
					"database.password": "secret123",
					"api.key":           "apikey123",
				},
			},
			expected: map[string]interface{}{
				"config": map[string]interface{}{
					"database.user":     "admin",
					"database.password": "***REDACTED***",
					"api.key":           "***REDACTED***",
				},
			},
		},
		{
			name: "Array with sensitive data",
			input: []interface{}{
				map[string]interface{}{
					"name":  "connector1",
					"token": "token123",
				},
				map[string]interface{}{
					"name":   "connector2",
					"secret": "secret456",
				},
			},
			expected: []interface{}{
				map[string]interface{}{
					"name":  "connector1",
					"token": "***REDACTED***",
				},
				map[string]interface{}{
					"name":   "connector2",
					"secret": "***REDACTED***",
				},
			},
		},
		{
			name: "Case insensitive matching",
			input: map[string]interface{}{
				"PASSWORD": "pass1",
				"Secret":   "secret1",
				"API_KEY":  "key1",
			},
			expected: map[string]interface{}{
				"PASSWORD": "***REDACTED***",
				"Secret":   "***REDACTED***",
				"API_KEY":  "***REDACTED***",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactSensitiveData(tt.input)

			// Convert to JSON for easy comparison
			resultJSON, _ := json.Marshal(result)
			expectedJSON, _ := json.Marshal(tt.expected)

			if string(resultJSON) != string(expectedJSON) {
				t.Errorf("redactSensitiveData() = %v, want %v", string(resultJSON), string(expectedJSON))
			}
		})
	}
}

func TestHealthHandler(t *testing.T) {
	t.Run("healthy when Kafka Connect is reachable", func(t *testing.T) {
		// Mock Kafka Connect server
		connectServer := testutils.NewConnectServer(map[string]testutils.Response{
			"GET /": {
				Status:  http.StatusOK,
				Body:    map[string]string{"version": "7.5.0", "commit": "abc123"},
				Headers: map[string]string{"Content-Type": "application/json"},
			},
		})
		defer connectServer.Close()

		originalURL := connectURL
		connectURL = connectServer.URL()
		t.Cleanup(func() {
			connectURL = originalURL
		})

		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		rr := httptest.NewRecorder()

		healthHandler(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", rr.Code)
		}

		if contentType := rr.Header().Get("Content-Type"); contentType != "application/json" {
			t.Fatalf("expected application/json content type, got %s", contentType)
		}

		var payload map[string]interface{}
		if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if payload["status"] != "healthy" {
			t.Fatalf("expected health status healthy, got %v", payload["status"])
		}

		kafkaConnect, ok := payload["kafka_connect"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected kafka_connect field in response")
		}

		if kafkaConnect["status"] != "reachable" {
			t.Fatalf("expected kafka_connect status reachable, got %v", kafkaConnect["status"])
		}
	})

	t.Run("unhealthy when Kafka Connect is unreachable", func(t *testing.T) {
		originalURL := connectURL
		connectURL = "http://localhost:1" // Invalid port - will fail to connect
		t.Cleanup(func() {
			connectURL = originalURL
		})

		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		rr := httptest.NewRecorder()

		healthHandler(rr, req)

		if rr.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected status 503, got %d", rr.Code)
		}

		var payload map[string]interface{}
		if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if payload["status"] != "unhealthy" {
			t.Fatalf("expected health status unhealthy, got %v", payload["status"])
		}

		if payload["reason"] == nil {
			t.Fatalf("expected reason field in unhealthy response")
		}
	})
}

func TestProxyHandler_ForwardsRequestsAndRedacts(t *testing.T) {
	responses := map[string]testutils.Response{
		"GET /connectors": {
			Status:  http.StatusOK,
			Body:    []string{"alpha"},
			Headers: map[string]string{"Content-Type": "application/json"},
		},
		"GET /connectors/datagen-users": {
			Status: http.StatusOK,
			Body: map[string]interface{}{
				"name": "datagen-users",
				"config": map[string]interface{}{
					"database.password": "supersecret",
					"key.converter":     "org.apache.kafka.connect.storage.StringConverter",
				},
			},
			Headers: map[string]string{"Content-Type": "application/json"},
		},
		"GET /connectors/datagen-users/status": {
			Status:  http.StatusOK,
			Body:    map[string]string{"state": "RUNNING"},
			Headers: map[string]string{"Content-Type": "application/json"},
		},
	}

	connectServer := testutils.NewConnectServer(responses)
	defer connectServer.Close()

	originalURL := connectURL
	connectURL = connectServer.URL()
	t.Cleanup(func() {
		connectURL = originalURL
	})

	listReq := httptest.NewRequest(http.MethodGet, "/api/default/connectors", nil)
	listReq = mux.SetURLVars(listReq, map[string]string{"cluster": "default"})
	listRecorder := httptest.NewRecorder()
	proxyHandler(listRecorder, listReq)

	if listRecorder.Code != http.StatusOK {
		t.Fatalf("expected status 200 for connectors list, got %d", listRecorder.Code)
	}

	var connectors []string
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &connectors); err != nil {
		t.Fatalf("failed to decode connectors response: %v", err)
	}

	if len(connectors) != 1 || connectors[0] != "alpha" {
		t.Fatalf("unexpected connectors payload: %v", connectors)
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/api/default/connectors/datagen-users", nil)
	detailReq = mux.SetURLVars(detailReq, map[string]string{"cluster": "default", "path": "datagen-users"})
	detailRecorder := httptest.NewRecorder()
	proxyHandler(detailRecorder, detailReq)

	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("expected status 200 for connector detail, got %d", detailRecorder.Code)
	}

	var detailPayload map[string]interface{}
	if err := json.Unmarshal(detailRecorder.Body.Bytes(), &detailPayload); err != nil {
		t.Fatalf("failed to decode connector detail: %v", err)
	}

	config, ok := detailPayload["config"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected config field in connector detail")
	}

	if got := config["database.password"]; got != "***REDACTED***" {
		t.Fatalf("expected database.password to be redacted, got %v", got)
	}

	if got := config["key.converter"]; got != "org.apache.kafka.connect.storage.StringConverter" {
		t.Fatalf("expected key.converter to remain unchanged, got %v", got)
	}

	statusReq := httptest.NewRequest(http.MethodGet, "/api/default/connectors/datagen-users/status", nil)
	statusReq = mux.SetURLVars(statusReq, map[string]string{"cluster": "default", "path": "datagen-users/status"})
	statusRecorder := httptest.NewRecorder()
	proxyHandler(statusRecorder, statusReq)

	if statusRecorder.Code != http.StatusOK {
		t.Fatalf("expected status 200 for connector status, got %d", statusRecorder.Code)
	}

	var statusPayload map[string]string
	if err := json.Unmarshal(statusRecorder.Body.Bytes(), &statusPayload); err != nil {
		t.Fatalf("failed to decode connector status: %v", err)
	}

	if statusPayload["state"] != "RUNNING" {
		t.Fatalf("expected connector state RUNNING, got %s", statusPayload["state"])
	}

	requests := connectServer.Requests()
	if len(requests) != 3 {
		t.Fatalf("expected 3 proxied requests, got %d", len(requests))
	}

	expectedPaths := []string{"/connectors", "/connectors/datagen-users", "/connectors/datagen-users/status"}
	for i, expectedPath := range expectedPaths {
		if requests[i].Path != expectedPath {
			t.Fatalf("request %d path = %s, want %s", i, requests[i].Path, expectedPath)
		}
	}
}
