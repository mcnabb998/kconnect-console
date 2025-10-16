package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/mcnabb998/kconnect-console/proxy/testutils"
)

type errReadCloser struct{}

func (errReadCloser) Read([]byte) (int, error) { return 0, errors.New("boom") }
func (errReadCloser) Close() error             { return nil }

func withTestConnectURL(t *testing.T, server *httptest.Server) func() {
	t.Helper()
	original := connectURL
	connectURL = server.URL
	return func() { connectURL = original }
}

func TestFetchFromKafkaConnect(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/connectors" {
			http.NotFound(w, r)
			return
		}
		io.WriteString(w, `["alpha"]`)
	}))
	defer server.Close()

	restore := withTestConnectURL(t, server)
	defer restore()

	body, err := fetchFromKafkaConnect("connectors")
	if err != nil {
		t.Fatalf("fetchFromKafkaConnect returned error: %v", err)
	}

	if got := strings.TrimSpace(string(body)); got != "[\"alpha\"]" {
		t.Fatalf("unexpected response: %s", got)
	}

	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})

	if _, err := fetchFromKafkaConnect("connectors"); err == nil {
		t.Fatalf("expected error for non-200 response")
	}

	connectURL = "http://127.0.0.1:1"
	if _, err := fetchFromKafkaConnect("connectors"); err == nil {
		t.Fatalf("expected connection error for unreachable host")
	}

	connectURL = "://bad-url"
	if _, err := fetchFromKafkaConnect("connectors"); err == nil {
		t.Fatalf("expected error creating request for invalid URL")
	}
}

func TestFetchConnectorNamesAndStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/connectors":
			io.WriteString(w, `["alpha"]`)
		case "/connectors/alpha/status":
			io.WriteString(w, `{"name":"alpha","connector":{"state":"RUNNING","worker_id":"1"},"tasks":[]}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := server.Client()

	names, err := fetchConnectorNames(context.Background(), client, server.URL)
	if err != nil {
		t.Fatalf("fetchConnectorNames returned error: %v", err)
	}
	if len(names) != 1 || names[0] != "alpha" {
		t.Fatalf("unexpected connector names: %v", names)
	}

	status, err := fetchConnectorStatus(context.Background(), client, server.URL, "alpha")
	if err != nil {
		t.Fatalf("fetchConnectorStatus returned error: %v", err)
	}
	if status.Name != "alpha" || status.Connector.State != "RUNNING" {
		t.Fatalf("unexpected status payload: %+v", status)
	}

	// invalid JSON path
	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/connectors" {
			io.WriteString(w, `{"oops":`)
			return
		}
		http.NotFound(w, r)
	})

	if _, err := fetchConnectorNames(context.Background(), client, server.URL); err == nil {
		t.Fatalf("expected decode error for connector names")
	}

	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/connectors" {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		http.NotFound(w, r)
	})
	if _, err := fetchConnectorNames(context.Background(), client, server.URL); err == nil {
		t.Fatalf("expected status error for connector names")
	}

	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/connectors":
			io.WriteString(w, `["alpha"]`)
		case "/connectors/alpha/status":
			w.WriteHeader(http.StatusBadGateway)
		default:
			http.NotFound(w, r)
		}
	})

	if _, err := fetchConnectorStatus(context.Background(), client, server.URL, "alpha"); err == nil {
		t.Fatalf("expected status error for connector status")
	}

	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/connectors":
			io.WriteString(w, `["alpha"]`)
		case "/connectors/alpha/status":
			io.WriteString(w, `{`)
		default:
			http.NotFound(w, r)
		}
	})

	if _, err := fetchConnectorStatus(context.Background(), client, server.URL, "alpha"); err == nil {
		t.Fatalf("expected decode error for connector status")
	}

	// unreachable host triggers connectUnavailableError
	_, err = fetchConnectorStatus(context.Background(), client, "http://127.0.0.1:1", "alpha")
	var cue *connectUnavailableError
	if err == nil || !strings.Contains(err.Error(), "unreachable") || !errors.As(err, &cue) {
		t.Fatalf("expected connectUnavailableError, got %v", err)
	}
}

func TestFetchClusterMetadata(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"cluster_id":"cluster-123","uptime_ms":1500}`)
	}))
	defer server.Close()

	client := server.Client()
	clusterID, uptime, err := fetchClusterMetadata(context.Background(), client, server.URL)
	if err != nil {
		t.Fatalf("fetchClusterMetadata returned error: %v", err)
	}
	if clusterID != "cluster-123" {
		t.Fatalf("unexpected cluster ID %q", clusterID)
	}
	if uptime != time.Second {
		t.Fatalf("unexpected uptime %v", uptime)
	}

	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	})
	if _, _, err := fetchClusterMetadata(context.Background(), client, server.URL); err == nil {
		t.Fatalf("expected error for non-200 metadata response")
	}

	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{`)
	})
	if _, _, err := fetchClusterMetadata(context.Background(), client, server.URL); err == nil {
		t.Fatalf("expected decode error for metadata response")
	}

	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"clusterId":"cluster-xyz","uptime":"5s"}`)
	}))
	defer other.Close()

	id, uptime, err := fetchClusterMetadata(context.Background(), other.Client(), other.URL)
	if err != nil {
		t.Fatalf("fetchClusterMetadata with uptime string returned error: %v", err)
	}
	if id != "cluster-xyz" || uptime != 5*time.Second {
		t.Fatalf("expected cluster-xyz and 5s, got %q and %v", id, uptime)
	}
}

func TestClusterInfoHandlerResponses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"foo":"bar"}`)
	}))
	defer server.Close()

	restore := withTestConnectURL(t, server)
	defer restore()

	req := httptest.NewRequest(http.MethodGet, "/api/default/cluster", nil)
	rr := httptest.NewRecorder()
	clusterInfoHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	connectURL = "http://127.0.0.1:1"
	rr = httptest.NewRecorder()
	clusterInfoHandler(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when connect unavailable, got %d", rr.Code)
	}
}

func TestClusterInfoHandlerBadURL(t *testing.T) {
	original := connectURL
	connectURL = "://bad-url"
	t.Cleanup(func() { connectURL = original })

	req := httptest.NewRequest(http.MethodGet, "/api/default/cluster", nil)
	rr := httptest.NewRecorder()
	clusterInfoHandler(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for invalid proxy URL, got %d", rr.Code)
	}
}

func TestSummaryHandlerAggregatesData(t *testing.T) {
	muxRouter := http.NewServeMux()
	muxRouter.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"cluster_id":"cluster-1"}`)
	})
	muxRouter.HandleFunc("/connectors", func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `["alpha"]`)
	})
	muxRouter.HandleFunc("/connectors/alpha", func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"config":{"connector.class":"demo","topics":"a"},"type":"source"}`)
	})
	muxRouter.HandleFunc("/connectors/alpha/status", func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"connector":{"state":"RUNNING"},"tasks":[{"state":"RUNNING"}],"type":"source"}`)
	})
	muxRouter.HandleFunc("/connector-plugins", func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `[{"class":"demo","type":"source","version":"1"}]`)
	})
	muxRouter.HandleFunc("/workers", func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `[{"worker_id":"worker-1"}]`)
	})

	server := httptest.NewServer(muxRouter)
	defer server.Close()

	restore := withTestConnectURL(t, server)
	defer restore()

	req := httptest.NewRequest(http.MethodGet, "/api/default/summary", nil)
	rr := httptest.NewRecorder()
	summaryHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode summary: %v", err)
	}

	if payload["clusterInfo"].(map[string]interface{})["cluster_id"] != "cluster-1" {
		t.Fatalf("expected cluster info to be populated")
	}
	connectorStats := payload["connectorStats"].(map[string]interface{})
	if connectorStats["total"].(float64) != 1 {
		t.Fatalf("expected total connectors = 1, got %v", connectorStats["total"])
	}
}

func TestClusterActionHandler(t *testing.T) {
	var received struct {
		path    string
		payload string
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		received.path = r.URL.Path
		received.payload = string(body)
		io.WriteString(w, `{"status":"ok"}`)
	}))
	defer server.Close()

	restore := withTestConnectURL(t, server)
	defer restore()

	body := bytes.NewBufferString(`{"foo":"bar"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/default/cluster/actions/restart", body)
	req = mux.SetURLVars(req, map[string]string{"cluster": "default", "action": "restart"})
	rr := httptest.NewRecorder()
	clusterActionHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if received.path != "/connectors/-/restart" {
		t.Fatalf("unexpected proxied path %q", received.path)
	}
	if received.payload != `{"foo":"bar"}` {
		t.Fatalf("unexpected payload %q", received.payload)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/default/cluster/actions/rebalance", nil)
	req = mux.SetURLVars(req, map[string]string{"cluster": "default", "action": "rebalance"})
	rr = httptest.NewRecorder()
	clusterActionHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for rebalance, got %d", rr.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/default/cluster/actions/unknown", nil)
	req = mux.SetURLVars(req, map[string]string{"cluster": "default", "action": "unknown"})
	rr = httptest.NewRecorder()
	clusterActionHandler(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unsupported action, got %d", rr.Code)
	}
}

func TestProxyHandlerHandlesMutations(t *testing.T) {
	responses := map[string]testutils.Response{
		"POST /connectors": {
			Status:  http.StatusCreated,
			Body:    map[string]string{"status": "created"},
			Headers: map[string]string{"Content-Type": "application/json"},
		},
		"PUT /connectors/alpha": {
			Status:  http.StatusOK,
			Body:    map[string]string{"status": "updated"},
			Headers: map[string]string{"Content-Type": "application/json"},
		},
		"DELETE /connectors/alpha": {
			Status: http.StatusNoContent,
		},
	}

	server := testutils.NewConnectServer(responses)
	defer server.Close()

	original := connectURL
	connectURL = server.URL()
	t.Cleanup(func() { connectURL = original })

	postReq := httptest.NewRequest(http.MethodPost, "/api/default/connectors", bytes.NewBufferString(`{"name":"alpha"}`))
	postReq.Header.Set("Content-Type", "application/json")
	postReq = mux.SetURLVars(postReq, map[string]string{"cluster": "default"})
	postRec := httptest.NewRecorder()
	proxyHandler(postRec, postReq)
	if postRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for connector creation, got %d", postRec.Code)
	}

	putReq := httptest.NewRequest(http.MethodPut, "/api/default/connectors/alpha", bytes.NewBufferString(`{"config":{}}`))
	putReq.Header.Set("Content-Type", "application/json")
	putReq = mux.SetURLVars(putReq, map[string]string{"cluster": "default", "path": "alpha"})
	putRec := httptest.NewRecorder()
	proxyHandler(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for connector update, got %d", putRec.Code)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/default/connectors/alpha", nil)
	deleteReq = mux.SetURLVars(deleteReq, map[string]string{"cluster": "default", "path": "alpha"})
	deleteRec := httptest.NewRecorder()
	proxyHandler(deleteRec, deleteReq)
	if deleteRec.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for connector delete, got %d", deleteRec.Code)
	}

	requests := server.Requests()
	if len(requests) != 3 {
		t.Fatalf("expected 3 proxied mutation requests, got %d", len(requests))
	}
	if requests[0].Method != http.MethodPost || requests[0].Path != "/connectors" {
		t.Fatalf("unexpected POST request metadata: %+v", requests[0])
	}
	if string(requests[0].Body) != `{"name":"alpha"}` {
		t.Fatalf("expected POST body to be forwarded, got %s", string(requests[0].Body))
	}
	if requests[1].Method != http.MethodPut || requests[1].Path != "/connectors/alpha" {
		t.Fatalf("unexpected PUT request metadata: %+v", requests[1])
	}
	if requests[2].Method != http.MethodDelete || requests[2].Path != "/connectors/alpha" {
		t.Fatalf("unexpected DELETE request metadata: %+v", requests[2])
	}
}

func TestProxyHandlerInvalidURL(t *testing.T) {
	original := connectURL
	connectURL = "://bad-url"
	t.Cleanup(func() { connectURL = original })

	req := httptest.NewRequest(http.MethodGet, "/api/default/connectors", nil)
	req = mux.SetURLVars(req, map[string]string{"cluster": "default"})
	rr := httptest.NewRecorder()
	proxyHandler(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for invalid proxy URL, got %d", rr.Code)
	}
}

func TestProxyHandlerProxyError(t *testing.T) {
	original := connectURL
	connectURL = "http://127.0.0.1:1"
	t.Cleanup(func() { connectURL = original })

	req := httptest.NewRequest(http.MethodGet, "/api/default/connectors", nil)
	req = mux.SetURLVars(req, map[string]string{"cluster": "default"})
	rr := httptest.NewRecorder()
	proxyHandler(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 when upstream is unreachable, got %d", rr.Code)
	}
}

func TestClusterActionHandlerReadError(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/default/cluster/actions/restart", nil)
	req.Body = errReadCloser{}
	req = mux.SetURLVars(req, map[string]string{"cluster": "default", "action": "restart"})
	rr := httptest.NewRecorder()
	clusterActionHandler(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when request body cannot be read, got %d", rr.Code)
	}
}

func TestClusterActionHandlerProxyError(t *testing.T) {
	original := connectURL
	connectURL = "http://127.0.0.1:1"
	t.Cleanup(func() { connectURL = original })

	req := httptest.NewRequest(http.MethodPost, "/api/default/cluster/actions/restart", bytes.NewBufferString(`{"foo":"bar"}`))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"cluster": "default", "action": "restart"})
	rr := httptest.NewRecorder()
	clusterActionHandler(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 when cluster action cannot reach upstream, got %d", rr.Code)
	}
}

func TestFetchMonitoringSummaryMetadataWarning(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/connectors":
			io.WriteString(w, `["alpha"]`)
		case "/connectors/alpha/status":
			io.WriteString(w, `{"name":"alpha","connector":{"state":"RUNNING"},"tasks":[]}`)
		default:
			io.WriteString(w, `{`)
		}
	}))
	defer server.Close()

	summary, err := fetchMonitoringSummary(context.Background(), server.Client(), server.URL)
	if err != nil {
		t.Fatalf("fetchMonitoringSummary should ignore metadata decode errors: %v", err)
	}
	if summary.ClusterID != "" {
		t.Fatalf("expected cluster ID to be empty when metadata fails, got %q", summary.ClusterID)
	}
}

func TestGetMonitoringSummaryCaches(t *testing.T) {
	resetMonitoringSummaryCache()
	var connectorCalls int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/connectors":
			atomic.AddInt32(&connectorCalls, 1)
			io.WriteString(w, `["alpha"]`)
		case strings.HasSuffix(r.URL.Path, "/status"):
			io.WriteString(w, `{"name":"alpha","connector":{"state":"RUNNING"},"tasks":[]}`)
		default:
			io.WriteString(w, `{"server_info":{"uptime_ms":1000},"cluster_id":"cluster"}`)
		}
	}))
	defer server.Close()

	restore := withTestConnectURL(t, server)
	defer restore()

	originalClient := monitoringHTTPClient
	monitoringHTTPClient = server.Client()
	t.Cleanup(func() { monitoringHTTPClient = originalClient })

	summaryCacheTTL = time.Second
	t.Cleanup(func() { summaryCacheTTL = 10 * time.Second })

	if _, err := getMonitoringSummary(context.Background()); err != nil {
		t.Fatalf("first getMonitoringSummary failed: %v", err)
	}
	if _, err := getMonitoringSummary(context.Background()); err != nil {
		t.Fatalf("second getMonitoringSummary failed: %v", err)
	}

	if atomic.LoadInt32(&connectorCalls) != 1 {
		t.Fatalf("expected connectors endpoint to be called once, got %d", connectorCalls)
	}
}

func TestFetchMonitoringSummaryPropagatesErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/connectors":
			io.WriteString(w, `["alpha"]`)
		case "/connectors/alpha/status":
			w.WriteHeader(http.StatusInternalServerError)
		default:
			io.WriteString(w, `{}`)
		}
	}))
	defer server.Close()

	client := server.Client()
	if _, err := fetchMonitoringSummary(context.Background(), client, server.URL); err == nil {
		t.Fatalf("expected error when connector status request fails")
	}
}

func TestMonitoringSummaryHandlerSuccess(t *testing.T) {
	resetMonitoringSummaryCache()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/connectors":
			io.WriteString(w, `["alpha"]`)
		case "/connectors/alpha/status":
			io.WriteString(w, `{"name":"alpha","connector":{"state":"RUNNING"},"tasks":[]}`)
		default:
			io.WriteString(w, `{"server_info":{"uptime_ms":2000},"cluster_id":"demo"}`)
		}
	}))
	defer server.Close()

	restore := withTestConnectURL(t, server)
	defer restore()

	originalClient := monitoringHTTPClient
	monitoringHTTPClient = server.Client()
	t.Cleanup(func() { monitoringHTTPClient = originalClient })

	req := httptest.NewRequest(http.MethodGet, "/api/default/monitoring/summary", nil)
	req = mux.SetURLVars(req, map[string]string{"cluster": "default"})
	rr := httptest.NewRecorder()

	monitoringSummaryHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var summary MonitoringSummary
	if err := json.Unmarshal(rr.Body.Bytes(), &summary); err != nil {
		t.Fatalf("failed to decode monitoring summary: %v", err)
	}

	if summary.ClusterID != "demo" {
		t.Fatalf("expected cluster ID demo, got %q", summary.ClusterID)
	}
	if summary.UptimeSeconds != 2 {
		t.Fatalf("expected uptime seconds 2, got %d", summary.UptimeSeconds)
	}
}
