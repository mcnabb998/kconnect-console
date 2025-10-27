package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/mcnabb998/kconnect-console/proxy/testutils"
)

func TestConnectorMetricsHandler_Success(t *testing.T) {
	// Create a mock Kafka Connect server
	mockConnect := testutils.NewJSONConnectServerWithTB(t, map[string]testutils.MockResponse{
		"/connectors/test-connector/status": {
			Body:   testutils.LoadFixture(t, "connector-status.json"),
			Status: http.StatusOK,
		},
	})
	defer mockConnect.Close()

	// Save original URLs and restore after test
	oldConnectURL := connectURL
	oldJolokiaURL := jolokiaURL
	defer func() {
		connectURL = oldConnectURL
		jolokiaURL = oldJolokiaURL
	}()

	// Point to mock server
	connectURL = mockConnect.URL

	// Create a mock Jolokia server (will fail gracefully)
	jolokiaURL = "http://127.0.0.1:1" // unreachable but won't cause test to fail

	// Create request
	req := httptest.NewRequest(http.MethodGet, "/api/default/connectors/test-connector/metrics", nil)
	req = mux.SetURLVars(req, map[string]string{
		"cluster": "default",
		"name":    "test-connector",
	})

	// Create response recorder
	w := httptest.NewRecorder()

	// Call handler
	connectorMetricsHandler(w, req)

	// Check response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Verify response is valid JSON
	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}
}

func TestConnectorMetricsHandler_MissingName(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/default/connectors//metrics", nil)
	req = mux.SetURLVars(req, map[string]string{
		"cluster": "default",
		"name":    "",
	})

	w := httptest.NewRecorder()
	connectorMetricsHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestConnectorMetricsHandler_ConnectorNotFound(t *testing.T) {
	// Create a mock Kafka Connect server
	mockConnect := testutils.NewJSONConnectServerWithTB(t, map[string]testutils.MockResponse{
		"/connectors/nonexistent/status": {
			Body:   []byte(`{"error_code":404,"message":"Connector nonexistent not found"}`),
			Status: http.StatusNotFound,
		},
	})
	defer mockConnect.Close()

	// Save original URL and restore after test
	oldConnectURL := connectURL
	defer func() {
		connectURL = oldConnectURL
	}()

	connectURL = mockConnect.URL

	req := httptest.NewRequest(http.MethodGet, "/api/default/connectors/nonexistent/metrics", nil)
	req = mux.SetURLVars(req, map[string]string{
		"cluster": "default",
		"name":    "nonexistent",
	})

	w := httptest.NewRecorder()
	connectorMetricsHandler(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", w.Code)
	}
}

func TestFetchConnectorMetrics_WithStatus(t *testing.T) {
	// Create a mock Kafka Connect server
	mockConnect := testutils.NewJSONConnectServerWithTB(t, map[string]testutils.MockResponse{
		"/connectors/test-connector/status": {
			Body:   testutils.LoadFixture(t, "connector-status.json"),
			Status: http.StatusOK,
		},
	})
	defer mockConnect.Close()

	// Save original URLs and restore after test
	oldConnectURL := connectURL
	oldJolokiaURL := jolokiaURL
	defer func() {
		connectURL = oldConnectURL
		jolokiaURL = oldJolokiaURL
	}()

	connectURL = mockConnect.URL
	jolokiaURL = "http://127.0.0.1:1" // unreachable

	ctx := context.Background()
	metrics, err := fetchConnectorMetrics(ctx, "test-connector")

	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	if metrics.ConnectorName != "test-connector" {
		t.Errorf("Expected connector name 'test-connector', got '%s'", metrics.ConnectorName)
	}

	if len(metrics.Tasks) == 0 {
		t.Error("Expected tasks to be populated from status")
	}
}

func TestGetConnectorMetrics_Caching(t *testing.T) {
	// Create a mock Kafka Connect server
	mockConnect := testutils.NewJSONConnectServerWithTB(t, map[string]testutils.MockResponse{
		"/connectors/cached-connector/status": {
			Body:   testutils.LoadFixture(t, "connector-status.json"),
			Status: http.StatusOK,
		},
	})
	defer mockConnect.Close()

	// Save original values
	oldConnectURL := connectURL
	oldJolokiaURL := jolokiaURL
	oldCacheTTL := metricsCacheTTL
	defer func() {
		connectURL = oldConnectURL
		jolokiaURL = oldJolokiaURL
		metricsCacheTTL = oldCacheTTL
		// Clear cache
		metricsCache.Lock()
		metricsCache.data = make(map[string]ConnectorMetrics)
		metricsCache.expiresAt = make(map[string]time.Time)
		metricsCache.Unlock()
	}()

	connectURL = mockConnect.URL
	jolokiaURL = "http://127.0.0.1:1"
	metricsCacheTTL = 1 * time.Second

	ctx := context.Background()

	// First call - should fetch from server
	metrics1, err := getConnectorMetrics(ctx, "cached-connector")
	if err != nil {
		t.Fatalf("First call failed: %v", err)
	}

	// Second call - should return from cache
	metrics2, err := getConnectorMetrics(ctx, "cached-connector")
	if err != nil {
		t.Fatalf("Second call failed: %v", err)
	}

	// Both should have same timestamp since cached
	if metrics1.LastUpdated != metrics2.LastUpdated {
		t.Error("Expected cached metrics to have same timestamp")
	}

	// Wait for cache to expire
	time.Sleep(1100 * time.Millisecond)

	// Third call - should fetch fresh data
	metrics3, err := getConnectorMetrics(ctx, "cached-connector")
	if err != nil {
		t.Fatalf("Third call failed: %v", err)
	}

	// Should have different timestamp
	if metrics1.LastUpdated == metrics3.LastUpdated {
		t.Error("Expected fresh metrics to have different timestamp")
	}
}

func TestFetchJolokiaMetric_InvalidURL(t *testing.T) {
	oldJolokiaURL := jolokiaURL
	defer func() {
		jolokiaURL = oldJolokiaURL
	}()

	jolokiaURL = "http://127.0.0.1:1" // unreachable

	ctx := context.Background()
	_, err := fetchJolokiaMetric(ctx, "test:mbean", "attribute")

	if err == nil {
		t.Error("Expected error when Jolokia is unreachable")
	}
}
