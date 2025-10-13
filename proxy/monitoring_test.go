package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/mux"
)

func TestFetchMonitoringSummaryAggregatesStates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/connectors":
			json.NewEncoder(w).Encode([]string{"alpha", "beta"})
		case "/connectors/alpha/status":
			json.NewEncoder(w).Encode(map[string]interface{}{
				"name": "alpha",
				"connector": map[string]interface{}{
					"state":     "RUNNING",
					"worker_id": "worker-a",
				},
				"tasks": []map[string]interface{}{
					{
						"id":    0,
						"state": "RUNNING",
					},
					{
						"id":    1,
						"state": "FAILED",
					},
				},
				"type": "source",
			})
		case "/connectors/beta/status":
			json.NewEncoder(w).Encode(map[string]interface{}{
				"name": "beta",
				"connector": map[string]interface{}{
					"state":     "PAUSED",
					"worker_id": "worker-b",
				},
				"tasks": []map[string]interface{}{
					{
						"id":    0,
						"state": "UNASSIGNED",
					},
					{
						"id":    1,
						"state": "CUSTOM",
					},
				},
				"type": "sink",
			})
		case "/":
			json.NewEncoder(w).Encode(map[string]interface{}{
				"server_info": map[string]interface{}{
					"uptime_ms": 9870,
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	summary, err := fetchMonitoringSummary(context.Background(), server.Client(), server.URL)
	if err != nil {
		t.Fatalf("fetchMonitoringSummary returned error: %v", err)
	}

	if summary.TotalConnectors != 2 {
		t.Fatalf("expected 2 connectors, got %d", summary.TotalConnectors)
	}

	if got := summary.ConnectorStates["running"]; got != 1 {
		t.Fatalf("expected 1 running connector, got %d", got)
	}

	if got := summary.ConnectorStates["paused"]; got != 1 {
		t.Fatalf("expected 1 paused connector, got %d", got)
	}

	expectedTaskStates := map[string]int{
		"running":    1,
		"failed":     1,
		"unassigned": 1,
		"unknown":    1,
	}

	for state, expected := range expectedTaskStates {
		if summary.TaskStates[state] != expected {
			t.Fatalf("expected %d tasks in state %s, got %d", expected, state, summary.TaskStates[state])
		}
	}

	if summary.UptimeSeconds != 9 {
		t.Fatalf("expected uptime 9 seconds, got %d", summary.UptimeSeconds)
	}

	if len(summary.Connectors) != 2 {
		t.Fatalf("expected 2 connector overviews, got %d", len(summary.Connectors))
	}

	overviewStates := map[string]string{}
	for _, overview := range summary.Connectors {
		overviewStates[overview.Name] = overview.State
	}

	if overviewStates["alpha"] != "running" {
		t.Fatalf("expected alpha state running, got %s", overviewStates["alpha"])
	}

	if overviewStates["beta"] != "paused" {
		t.Fatalf("expected beta state paused, got %s", overviewStates["beta"])
	}
}

func TestMonitoringSummaryHandlerUnavailableConnect(t *testing.T) {
	resetMonitoringSummaryCache()
	originalURL := connectURL
	connectURL = "http://127.0.0.1:1"
	t.Cleanup(func() {
		connectURL = originalURL
	})

	originalClient := monitoringHTTPClient
	monitoringHTTPClient = &http.Client{Timeout: 50 * time.Millisecond}
	t.Cleanup(func() {
		monitoringHTTPClient = originalClient
	})

	req := httptest.NewRequest(http.MethodGet, "/api/default/monitoring/summary", nil)
	req = mux.SetURLVars(req, map[string]string{"cluster": "default"})
	rr := httptest.NewRecorder()

	monitoringSummaryHandler(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", rr.Code)
	}

	var payload map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if payload["error"] != "connect_unreachable" {
		t.Fatalf("expected error connect_unreachable, got %s", payload["error"])
	}

	if payload["message"] == "" {
		t.Fatalf("expected error message to be populated")
	}
}

func TestMonitoringSummaryHandlerUsesCache(t *testing.T) {
	resetMonitoringSummaryCache()

	var mu sync.Mutex
	connectorCalls := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/connectors":
			mu.Lock()
			connectorCalls++
			mu.Unlock()
			json.NewEncoder(w).Encode([]string{"alpha"})
		case "/connectors/alpha/status":
			json.NewEncoder(w).Encode(map[string]interface{}{
				"name": "alpha",
				"connector": map[string]interface{}{
					"state":     "RUNNING",
					"worker_id": "worker-a",
				},
				"tasks": []map[string]interface{}{},
				"type":  "source",
			})
		case "/":
			json.NewEncoder(w).Encode(map[string]interface{}{
				"uptime": 42,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	originalURL := connectURL
	connectURL = server.URL
	t.Cleanup(func() {
		connectURL = originalURL
	})

	originalClient := monitoringHTTPClient
	monitoringHTTPClient = server.Client()
	t.Cleanup(func() {
		monitoringHTTPClient = originalClient
	})

	originalTTL := summaryCacheTTL
	summaryCacheTTL = time.Minute
	t.Cleanup(func() {
		summaryCacheTTL = originalTTL
	})

	req := httptest.NewRequest(http.MethodGet, "/api/default/monitoring/summary", nil)
	req = mux.SetURLVars(req, map[string]string{"cluster": "default"})

	rr := httptest.NewRecorder()
	monitoringSummaryHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	rr2 := httptest.NewRecorder()
	monitoringSummaryHandler(rr2, req)
	if rr2.Code != http.StatusOK {
		t.Fatalf("expected status 200 on cached response, got %d", rr2.Code)
	}

	mu.Lock()
	calls := connectorCalls
	mu.Unlock()

	if calls != 1 {
		t.Fatalf("expected connectors endpoint to be called once, got %d", calls)
	}
}
