package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

var (
	connectURL     = getEnv("KAFKA_CONNECT_URL", "http://localhost:8083")
	allowedOrigins = getEnv("ALLOWED_ORIGINS", "*")
	// Only redact true secret-like keys (including camelCase variants); avoid generic "key.converter"
	sensitivePattern = regexp.MustCompile(`(?i)(?:^|[._-]|[a-z0-9])(password|secret|api[._-]?key|access[._-]?key|secret[._-]?key|token|credential(s)?)(?:$|[._-]|[a-z0-9])`)
	safeExactKeys    = map[string]struct{}{
		"key.converter":            {},
		"value.converter":          {},
		"internal.key.converter":   {},
		"internal.value.converter": {},
	}
	monitoringHTTPClient   = &http.Client{}
	summaryCacheTTL        = 10 * time.Second
	monitoringSummaryCache = struct {
		sync.Mutex
		data      MonitoringSummary
		expiresAt time.Time
		valid     bool
		fetching  bool // Prevents thundering herd
	}{}
)

// MonitoringSummary represents aggregated status information for connectors.
type MonitoringSummary struct {
	ClusterID       string                    `json:"clusterId,omitempty"`
	TotalConnectors int                       `json:"totalConnectors"`
	ConnectorStates map[string]int            `json:"connectorStates"`
	TaskStates      map[string]int            `json:"taskStates"`
	Totals          map[string]int            `json:"totals,omitempty"`
	UptimeSeconds   int64                     `json:"uptimeSeconds"`
	Uptime          string                    `json:"uptime,omitempty"`
	Connectors      []ConnectorStatusOverview `json:"connectors"`
}

// ConnectorStatusOverview provides a condensed view of an individual connector.
type ConnectorStatusOverview struct {
	Name  string `json:"name"`
	State string `json:"state"`
	Type  string `json:"type"`
}

type connectorStatusResponse struct {
	Name      string `json:"name"`
	Connector struct {
		State    string `json:"state"`
		WorkerID string `json:"worker_id"`
	} `json:"connector"`
	Tasks []struct {
		ID       int    `json:"id"`
		State    string `json:"state"`
		WorkerID string `json:"worker_id"`
	} `json:"tasks"`
	Type string `json:"type"`
}

type connectUnavailableError struct {
	err error
}

func (e *connectUnavailableError) Error() string {
	return fmt.Sprintf("kafka connect is unreachable: %v", e.err)
}

func (e *connectUnavailableError) Unwrap() error {
	return e.err
}

func newStateCounter() map[string]int {
	return map[string]int{
		"running":    0,
		"paused":     0,
		"failed":     0,
		"unassigned": 0,
		"unknown":    0,
	}
}

func normalizeState(state string) string {
	switch strings.ToUpper(state) {
	case "RUNNING":
		return "running"
	case "PAUSED":
		return "paused"
	case "FAILED":
		return "failed"
	case "UNASSIGNED":
		return "unassigned"
	default:
		return "unknown"
	}
}

func joinURL(base string, parts ...string) string {
	trimmed := strings.TrimSuffix(base, "/")
	for _, part := range parts {
		if part == "" {
			continue
		}
		trimmed += "/" + strings.TrimPrefix(part, "/")
	}
	return trimmed
}

// fetchFromKafkaConnect makes a GET request to a Kafka Connect endpoint and returns the response body
func fetchFromKafkaConnect(endpoint string) ([]byte, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodGet, joinURL(connectURL, endpoint), nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, &connectUnavailableError{err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status from %s: %d", endpoint, resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// clusterInfoHandler returns Kafka Connect cluster information
func clusterInfoHandler(w http.ResponseWriter, r *http.Request) {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodGet, strings.TrimSuffix(connectURL, "/"), nil)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		log.Printf("cluster info: create request error: %v", err)
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(connectUnavailableError{err: err})
		log.Printf("cluster info: request error: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Unexpected status from cluster endpoint: %d", resp.StatusCode), resp.StatusCode)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read response", http.StatusInternalServerError)
		log.Printf("cluster info: read response error: %v", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(body)
}

func fetchConnectorNames(ctx context.Context, client *http.Client, baseURL string) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, joinURL(baseURL, "connectors"), nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, &connectUnavailableError{err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status fetching connectors: %d", resp.StatusCode)
	}

	var names []string
	if err := json.NewDecoder(resp.Body).Decode(&names); err != nil {
		return nil, fmt.Errorf("decode connectors: %w", err)
	}

	return names, nil
}

func fetchConnectorStatus(ctx context.Context, client *http.Client, baseURL, name string) (connectorStatusResponse, error) {
	escaped := url.PathEscape(name)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, joinURL(baseURL, "connectors", escaped, "status"), nil)
	if err != nil {
		return connectorStatusResponse{}, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return connectorStatusResponse{}, &connectUnavailableError{err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return connectorStatusResponse{}, fmt.Errorf("unexpected status fetching connector %s: %d", name, resp.StatusCode)
	}

	var status connectorStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return connectorStatusResponse{}, fmt.Errorf("decode connector status for %s: %w", name, err)
	}

	return status, nil
}

func fetchClusterMetadata(ctx context.Context, client *http.Client, baseURL string) (string, time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSuffix(baseURL, "/"), nil)
	if err != nil {
		return "", 0, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", 0, &connectUnavailableError{err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("unexpected status fetching connect metadata: %d", resp.StatusCode)
	}

	var payload map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", 0, fmt.Errorf("decode connect metadata: %w", err)
	}

	clusterID, _ := extractClusterID(payload)
	if uptime, ok := extractUptimeSeconds(payload); ok {
		return clusterID, time.Duration(uptime) * time.Second, nil
	}

	return clusterID, 0, nil
}

func extractUptimeSeconds(data map[string]interface{}) (int64, bool) {
	for key, value := range data {
		switch v := value.(type) {
		case map[string]interface{}:
			if uptime, ok := extractUptimeSeconds(v); ok {
				return uptime, true
			}
		case []interface{}:
			for _, item := range v {
				if nested, ok := item.(map[string]interface{}); ok {
					if uptime, ok := extractUptimeSeconds(nested); ok {
						return uptime, true
					}
				}
			}
		default:
			if strings.EqualFold(key, "uptime_ms") {
				ms, err := parseMilliseconds(v)
				if err == nil {
					return ms / 1000, true
				}
			}
			if strings.EqualFold(key, "uptime") {
				seconds, err := parseSeconds(v)
				if err == nil {
					return seconds, true
				}
			}
		}
	}
	return 0, false
}

func extractClusterID(data map[string]interface{}) (string, bool) {
	for key, value := range data {
		switch v := value.(type) {
		case map[string]interface{}:
			if id, ok := extractClusterID(v); ok {
				return id, true
			}
		case []interface{}:
			for _, item := range v {
				if nested, ok := item.(map[string]interface{}); ok {
					if id, ok := extractClusterID(nested); ok {
						return id, true
					}
				}
			}
		case string:
			normalizedKey := strings.ToLower(strings.ReplaceAll(key, "-", "_"))
			normalizedKey = strings.ReplaceAll(normalizedKey, ".", "_")
			if normalizedKey == "cluster_id" || normalizedKey == "clusterid" {
				trimmed := strings.TrimSpace(v)
				if trimmed != "" {
					return trimmed, true
				}
			}
		}
	}
	return "", false
}

func parseMilliseconds(value interface{}) (int64, error) {
	switch v := value.(type) {
	case float64:
		return int64(v), nil
	case int64:
		return v, nil
	case json.Number:
		i, err := v.Int64()
		if err != nil {
			return 0, err
		}
		return i, nil
	case string:
		s := strings.TrimSpace(v)
		lower := strings.ToLower(s)
		switch {
		case strings.HasSuffix(lower, "ms"):
			return parseInt(strings.TrimSpace(s[:len(s)-2]))
		case strings.HasSuffix(lower, "s"):
			seconds, err := parseInt(strings.TrimSpace(s[:len(s)-1]))
			if err != nil {
				return 0, err
			}
			return seconds * 1000, nil
		default:
			return parseInt(s)
		}
	default:
		return 0, fmt.Errorf("unsupported numeric type %T", value)
	}
}

func parseSeconds(value interface{}) (int64, error) {
	switch v := value.(type) {
	case float64:
		return int64(v), nil
	case int64:
		return v, nil
	case json.Number:
		i, err := v.Int64()
		if err != nil {
			return 0, err
		}
		return i, nil
	case string:
		s := strings.TrimSpace(v)
		lower := strings.ToLower(s)
		switch {
		case strings.HasSuffix(lower, "ms"):
			ms, err := parseInt(strings.TrimSpace(s[:len(s)-2]))
			if err != nil {
				return 0, err
			}
			return ms / 1000, nil
		case strings.HasSuffix(lower, "s"):
			return parseInt(strings.TrimSpace(s[:len(s)-1]))
		default:
			return parseInt(s)
		}
	default:
		return 0, fmt.Errorf("unsupported numeric type %T", value)
	}
}

func parseInt(value string) (int64, error) {
	if value == "" {
		return 0, fmt.Errorf("empty numeric value")
	}
	return strconv.ParseInt(value, 10, 64)
}

func formatUptime(d time.Duration) string {
	if d <= 0 {
		return "unknown"
	}

	type unit struct {
		duration time.Duration
		label    string
	}

	units := []unit{
		{duration: 24 * time.Hour, label: "d"},
		{duration: time.Hour, label: "h"},
		{duration: time.Minute, label: "m"},
		{duration: time.Second, label: "s"},
	}

	var parts []string
	remaining := d

	for _, u := range units {
		if remaining < u.duration {
			continue
		}
		value := remaining / u.duration
		if value > 0 {
			parts = append(parts, fmt.Sprintf("%d%s", value, u.label))
			remaining -= value * u.duration
		}
	}

	if len(parts) == 0 {
		return "<1s"
	}

	if len(parts) > 2 {
		parts = parts[:2]
	}

	return strings.Join(parts, " ")
}

func fetchMonitoringSummary(ctx context.Context, client *http.Client, baseURL string) (MonitoringSummary, error) {
	names, err := fetchConnectorNames(ctx, client, baseURL)
	if err != nil {
		return MonitoringSummary{}, err
	}

	connectorStates := newStateCounter()
	taskStates := newStateCounter()
	overviews := make([]ConnectorStatusOverview, 0, len(names))
	runningConnectors := 0
	degradedConnectors := 0
	failedConnectors := 0

	for _, name := range names {
		status, err := fetchConnectorStatus(ctx, client, baseURL, name)
		if err != nil {
			return MonitoringSummary{}, err
		}

		state := normalizeState(status.Connector.State)
		connectorStates[state]++
		overviews = append(overviews, ConnectorStatusOverview{
			Name:  status.Name,
			State: state,
			Type:  status.Type,
		})

		hasRunningTask := false
		hasFailedTask := false
		for _, task := range status.Tasks {
			taskState := normalizeState(task.State)
			taskStates[taskState]++
			if taskState == "running" {
				hasRunningTask = true
			}
			if taskState == "failed" {
				hasFailedTask = true
			}
		}

		switch {
		case hasFailedTask && hasRunningTask:
			degradedConnectors++
		case hasFailedTask:
			failedConnectors++
		default:
			switch state {
			case "failed":
				failedConnectors++
			case "running":
				runningConnectors++
			default:
				degradedConnectors++
			}
		}
	}

	totals := map[string]int{
		"total":    len(names),
		"running":  runningConnectors,
		"degraded": degradedConnectors,
		"failed":   failedConnectors,
	}

	clusterID := ""
	uptime := time.Duration(0)

	metadataClusterID, metadataUptime, err := fetchClusterMetadata(ctx, client, baseURL)
	if err != nil {
		var cue *connectUnavailableError
		if errors.As(err, &cue) {
			return MonitoringSummary{}, err
		}
		log.Printf("warning: failed to fetch connect uptime: %v", err)
	} else {
		clusterID = metadataClusterID
		uptime = metadataUptime
	}

	summary := MonitoringSummary{
		ClusterID:       clusterID,
		TotalConnectors: len(names),
		ConnectorStates: connectorStates,
		TaskStates:      taskStates,
		Totals:          totals,
		UptimeSeconds:   int64((uptime / time.Second)),
		Uptime:          formatUptime(uptime),
		Connectors:      overviews,
	}

	return summary, nil
}

func getMonitoringSummary(ctx context.Context) (MonitoringSummary, error) {
	now := time.Now()

	// Fast path: return cached data if still valid
	monitoringSummaryCache.Lock()
	if monitoringSummaryCache.valid && now.Before(monitoringSummaryCache.expiresAt) {
		summary := monitoringSummaryCache.data
		monitoringSummaryCache.Unlock()
		return summary, nil
	}

	// Cache is expired or invalid - check if someone is already fetching
	if monitoringSummaryCache.fetching {
		// Another goroutine is fetching, wait and return stale data or wait for fresh data
		// Return stale data if available to prevent blocking
		if monitoringSummaryCache.valid {
			summary := monitoringSummaryCache.data
			monitoringSummaryCache.Unlock()
			return summary, nil
		}
		// No stale data available, unlock and wait briefly then retry
		monitoringSummaryCache.Unlock()
		time.Sleep(100 * time.Millisecond)
		return getMonitoringSummary(ctx) // Retry
	}

	// Mark that we're fetching to prevent thundering herd
	monitoringSummaryCache.fetching = true
	monitoringSummaryCache.Unlock()

	// Fetch new data
	summary, err := fetchMonitoringSummary(ctx, monitoringHTTPClient, connectURL)

	// Update cache regardless of success/failure
	monitoringSummaryCache.Lock()
	monitoringSummaryCache.fetching = false
	if err == nil {
		monitoringSummaryCache.data = summary
		monitoringSummaryCache.expiresAt = time.Now().Add(summaryCacheTTL)
		monitoringSummaryCache.valid = true
	}
	// If fetch failed but we have old data, keep it valid for graceful degradation
	// (expiresAt stays in the past, but valid=true allows stale reads)
	monitoringSummaryCache.Unlock()

	if err != nil {
		return MonitoringSummary{}, err
	}

	return summary, nil
}

func resetMonitoringSummaryCache() {
	monitoringSummaryCache.Lock()
	monitoringSummaryCache.data = MonitoringSummary{}
	monitoringSummaryCache.expiresAt = time.Time{}
	monitoringSummaryCache.valid = false
	monitoringSummaryCache.Unlock()
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// redactSensitiveData recursively redacts sensitive values in JSON
func redactSensitiveData(data interface{}) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		result := make(map[string]interface{})
		for key, value := range v {
			lk := strings.ToLower(key)
			if _, ok := safeExactKeys[lk]; ok {
				result[key] = redactSensitiveData(value)
				continue
			}
			if sensitivePattern.MatchString(lk) {
				result[key] = "***REDACTED***"
			} else {
				result[key] = redactSensitiveData(value)
			}
		}
		return result
	case []interface{}:
		result := make([]interface{}, len(v))
		for i, item := range v {
			result[i] = redactSensitiveData(item)
		}
		return result
	default:
		return v
	}
}

func copyHeaders(dst, src http.Header) {
	for key, values := range src {
		if strings.EqualFold(key, "Host") || strings.EqualFold(key, "Content-Length") {
			continue
		}
		dst.Del(key)
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func writeRedactedResponse(w http.ResponseWriter, resp *http.Response) error {
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response body: %w", err)
	}

	var jsonData interface{}
	if err := json.Unmarshal(body, &jsonData); err == nil {
		redacted := redactSensitiveData(jsonData)
		redactedBody, err := json.Marshal(redacted)
		if err != nil {
			return fmt.Errorf("marshal redacted data: %w", err)
		}
		body = redactedBody
	}

	for key, values := range resp.Header {
		if strings.EqualFold(key, "Content-Length") {
			continue
		}
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	w.WriteHeader(resp.StatusCode)
	if _, err := w.Write(body); err != nil {
		return fmt.Errorf("write response body: %w", err)
	}
	return nil
}

// buildProxyURL constructs the target Kafka Connect URL from the incoming request
func buildProxyURL(r *http.Request) (*url.URL, error) {
	// Parse the base Kafka Connect URL
	baseURL, err := url.Parse(connectURL)
	if err != nil {
		return nil, fmt.Errorf("invalid connect URL: %w", err)
	}

	// Build the target path by extracting everything after /api/{cluster}/
	// Example: /api/default/connectors/my-connector/status -> /connectors/my-connector/status
	requestPath := strings.TrimPrefix(r.URL.Path, "/")
	pathParts := strings.SplitN(requestPath, "/", 3) // Split into: ["api", "cluster", "rest/of/path"]

	var targetPath string
	if len(pathParts) >= 3 && pathParts[2] != "" {
		// Use everything after /api/{cluster}/
		targetPath = "/" + pathParts[2]
	} else {
		// Fallback for malformed requests
		targetPath = "/connectors"
	}

	// Combine base URL path with target path, handling trailing slashes properly
	basePath := strings.TrimSuffix(baseURL.Path, "/")
	baseURL.Path = basePath + targetPath

	// Preserve query parameters from original request
	baseURL.RawQuery = r.URL.RawQuery

	return baseURL, nil
}

// proxyHandler forwards requests to Kafka Connect and redacts sensitive data
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	// Build target URL using proper URL parsing
	targetURL, err := buildProxyURL(r)
	if err != nil {
		http.Error(w, "Invalid proxy URL", http.StatusInternalServerError)
		log.Printf("Error building proxy URL for %s: %v", r.URL.Path, err)
		return
	}

	log.Printf("Proxying %s %s to %s", r.Method, r.URL.Path, targetURL.String())

	// Create the proxy request
	proxyReq, err := http.NewRequestWithContext(r.Context(), r.Method, targetURL.String(), r.Body)
	if err != nil {
		http.Error(w, "Failed to create proxy request", http.StatusInternalServerError)
		log.Printf("Error creating proxy request: %v", err)
		return
	}

	// Copy headers
	copyHeaders(proxyReq.Header, r.Header)

	// Make the request
	client := &http.Client{}
	resp, err := client.Do(proxyReq)
	if err != nil {
		http.Error(w, "Failed to proxy request", http.StatusBadGateway)
		log.Printf("Error proxying request: %v", err)
		return
	}
	if err := writeRedactedResponse(w, resp); err != nil {
		log.Printf("failed to stream proxy response: %v", err)
	}
}

func clusterActionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	action := vars["action"]

	var targetURL string
	switch strings.ToLower(action) {
	case "restart", "restart-all":
		targetURL = joinURL(connectURL, "connectors", "-", "restart")
	case "rebalance":
		targetURL = joinURL(connectURL, "admin", "rebalance")
	default:
		http.Error(w, fmt.Sprintf("unsupported cluster action: %s", action), http.StatusBadRequest)
		return
	}

	payload, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		log.Printf("cluster action %s: read body error: %v", action, err)
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, targetURL, bytes.NewReader(payload))
	if err != nil {
		http.Error(w, "Failed to create cluster action request", http.StatusInternalServerError)
		log.Printf("cluster action %s: create request error: %v", action, err)
		return
	}

	copyHeaders(req.Header, r.Header)
	if len(payload) > 0 && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "Failed to execute cluster action", http.StatusBadGateway)
		log.Printf("cluster action %s: proxy error: %v", action, err)
		return
	}

	if err := writeRedactedResponse(w, resp); err != nil {
		log.Printf("cluster action %s: failed to stream response: %v", action, err)
	}
}

// healthHandler returns the health status
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
	})
}

func monitoringSummaryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestedCluster := vars["cluster"]

	summary, err := getMonitoringSummary(r.Context())
	if err != nil {
		status := http.StatusBadGateway
		payload := map[string]string{
			"error":   "summary_fetch_failed",
			"message": err.Error(),
		}

		var cue *connectUnavailableError
		if errors.As(err, &cue) {
			status = http.StatusServiceUnavailable
			payload["error"] = "connect_unreachable"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if err := json.NewEncoder(w).Encode(payload); err != nil {
			log.Printf("failed to encode error response: %v", err)
		}
		return
	}

	if summary.ClusterID == "" {
		summary.ClusterID = requestedCluster
	}
	if summary.Uptime == "" && summary.UptimeSeconds > 0 {
		summary.Uptime = formatUptime(time.Duration(summary.UptimeSeconds) * time.Second)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(summary); err != nil {
		log.Printf("failed to encode summary response: %v", err)
	}
}

// summaryHandler provides aggregated cluster information for the settings page
func summaryHandler(w http.ResponseWriter, r *http.Request) {
	// Aggregate data from multiple endpoints
	type Summary struct {
		ClusterInfo      map[string]interface{}   `json:"clusterInfo"`
		ConnectorPlugins []map[string]interface{} `json:"connectorPlugins"`
		ConnectorStats   struct {
			Total   int `json:"total"`
			Running int `json:"running"`
			Failed  int `json:"failed"`
			Paused  int `json:"paused"`
		} `json:"connectorStats"`
		WorkerInfo map[string]interface{} `json:"workerInfo"`
	}

	summary := Summary{}

	// Fetch cluster info from root endpoint
	clusterResp, err := http.Get(strings.TrimSuffix(connectURL, "/"))
	if err == nil {
		defer clusterResp.Body.Close()
		if clusterResp.StatusCode == http.StatusOK {
			body, err := io.ReadAll(clusterResp.Body)
			if err == nil {
				var clusterData map[string]interface{}
				if err := json.Unmarshal(body, &clusterData); err == nil {
					summary.ClusterInfo = clusterData
				}
			}
		}
	}

	// Fetch connector plugins
	pluginsResp, err := fetchFromKafkaConnect("connector-plugins")
	if err == nil {
		var pluginsData []map[string]interface{}
		if err := json.Unmarshal(pluginsResp, &pluginsData); err == nil {
			summary.ConnectorPlugins = pluginsData
		}
	}

	// Fetch connector stats
	connectorsResp, err := fetchFromKafkaConnect("connectors")
	if err == nil {
		var connectors []string
		if err := json.Unmarshal(connectorsResp, &connectors); err == nil {
			summary.ConnectorStats.Total = len(connectors)

			// Count connector states (simplified for now)
			for _, connectorName := range connectors {
				statusResp, err := fetchFromKafkaConnect(fmt.Sprintf("connectors/%s/status", connectorName))
				if err == nil {
					var status map[string]interface{}
					if err := json.Unmarshal(statusResp, &status); err == nil {
						if connector, ok := status["connector"].(map[string]interface{}); ok {
							if state, ok := connector["state"].(string); ok {
								switch strings.ToUpper(state) {
								case "RUNNING":
									summary.ConnectorStats.Running++
								case "FAILED":
									summary.ConnectorStats.Failed++
								case "PAUSED":
									summary.ConnectorStats.Paused++
								}
							}
						}
					}
				}
			}
		}
	}

	// Fetch worker info (first worker for simplicity)
	workersResp, err := fetchFromKafkaConnect("workers")
	if err == nil {
		var workers []map[string]interface{}
		if err := json.Unmarshal(workersResp, &workers); err == nil && len(workers) > 0 {
			summary.WorkerInfo = workers[0]
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(summary); err != nil {
		log.Printf("failed to encode summary response: %v", err)
	}
}

func main() {
	router := mux.NewRouter()

	// Health check endpoint
	router.HandleFunc("/health", healthHandler).Methods("GET")

	// Proxy routes for Kafka Connect
	router.HandleFunc("/api/{cluster}/connectors", proxyHandler).Methods("GET", "POST")
	router.HandleFunc("/api/{cluster}/connectors/", proxyHandler).Methods("GET", "POST")
	router.HandleFunc("/api/{cluster}/connectors/{path:.*}", proxyHandler).Methods("GET", "POST", "PUT", "DELETE")
	router.HandleFunc("/api/{cluster}/workers", proxyHandler).Methods("GET")
	router.HandleFunc("/api/{cluster}/workers/{path:.*}", proxyHandler).Methods("GET")
	router.HandleFunc("/api/{cluster}/admin", proxyHandler).Methods("GET", "POST")
	router.HandleFunc("/api/{cluster}/admin/{path:.*}", proxyHandler).Methods("GET", "POST")
	router.HandleFunc("/api/{cluster}/cluster/actions/{action}", clusterActionHandler).Methods("POST")
	// Settings page endpoints
	router.HandleFunc("/api/{cluster}/cluster", clusterInfoHandler).Methods("GET")
	router.HandleFunc("/api/{cluster}/summary", summaryHandler).Methods("GET")
	// Plugins + validate
	router.HandleFunc("/api/{cluster}/connector-plugins", proxyHandler).Methods("GET")
	router.HandleFunc("/api/{cluster}/connector-plugins/{path:.*}", proxyHandler).Methods("GET", "PUT")
	router.HandleFunc("/api/{cluster}/monitoring/summary", monitoringSummaryHandler).Methods("GET")

	// CORS configuration
	// In production, set ALLOWED_ORIGINS environment variable to specific domains
	// e.g., ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
	origins := []string{"*"}
	if allowedOrigins != "*" {
		origins = []string{allowedOrigins}
	}

	c := cors.New(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: allowedOrigins != "*", // Only allow credentials if origins are restricted
	})

	handler := c.Handler(router)

	port := getEnv("PORT", "8080")
	log.Printf("Starting proxy server on port %s", port)
	log.Printf("Forwarding to Kafka Connect at %s", connectURL)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
