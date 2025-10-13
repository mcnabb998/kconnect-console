package main

import (
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
	// Only redact true secret-like keys; avoid generic "key.converter"
	sensitivePattern = regexp.MustCompile(`(?i)(^|[._-])(password|secret|api[._-]?key|access[._-]?key|secret[._-]?key|token|credential(s)?)([._-]|$)`)
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
	}{}
)
)

// MonitoringSummary represents aggregated status information for connectors.
type MonitoringSummary struct {
	TotalConnectors int                       `json:"totalConnectors"`
	ConnectorStates map[string]int            `json:"connectorStates"`
	TaskStates      map[string]int            `json:"taskStates"`
	UptimeSeconds   int64                     `json:"uptimeSeconds"`
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

func fetchClusterUptime(ctx context.Context, client *http.Client, baseURL string) (time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSuffix(baseURL, "/"), nil)
	if err != nil {
		return 0, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, &connectUnavailableError{err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("unexpected status fetching connect metadata: %d", resp.StatusCode)
	}

	var payload map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, fmt.Errorf("decode connect metadata: %w", err)
	}

	if uptime, ok := extractUptimeSeconds(payload); ok {
		return time.Duration(uptime) * time.Second, nil
	}

	return 0, nil
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

func fetchMonitoringSummary(ctx context.Context, client *http.Client, baseURL string) (MonitoringSummary, error) {
	names, err := fetchConnectorNames(ctx, client, baseURL)
	if err != nil {
		return MonitoringSummary{}, err
	}

	connectorStates := newStateCounter()
	taskStates := newStateCounter()
	overviews := make([]ConnectorStatusOverview, 0, len(names))

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

		for _, task := range status.Tasks {
			taskState := normalizeState(task.State)
			taskStates[taskState]++
		}
	}

	uptime, err := fetchClusterUptime(ctx, client, baseURL)
	if err != nil {
		var cue *connectUnavailableError
		if errors.As(err, &cue) {
			return MonitoringSummary{}, err
		}
		log.Printf("warning: failed to fetch connect uptime: %v", err)
	}

	summary := MonitoringSummary{
		TotalConnectors: len(names),
		ConnectorStates: connectorStates,
		TaskStates:      taskStates,
		UptimeSeconds:   int64(uptime.Seconds()),
		Connectors:      overviews,
	}

	return summary, nil
}

func getMonitoringSummary(ctx context.Context) (MonitoringSummary, error) {
	now := time.Now()

	monitoringSummaryCache.Lock()
	if monitoringSummaryCache.valid && now.Before(monitoringSummaryCache.expiresAt) {
		summary := monitoringSummaryCache.data
		monitoringSummaryCache.Unlock()
		return summary, nil
	}
	monitoringSummaryCache.Unlock()

	summary, err := fetchMonitoringSummary(ctx, monitoringHTTPClient, connectURL)
	if err != nil {
		return MonitoringSummary{}, err
	}

	monitoringSummaryCache.Lock()
	monitoringSummaryCache.data = summary
	monitoringSummaryCache.expiresAt = time.Now().Add(summaryCacheTTL)
	monitoringSummaryCache.valid = true
	monitoringSummaryCache.Unlock()

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

// proxyHandler forwards requests to Kafka Connect and redacts sensitive data
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	_ = vars["cluster"] // cluster variable for future use
	path := vars["path"]

	// Build the target URL - extract the endpoint from the request path
	var targetURL string
	if path == "" {
		// Extract endpoint from request path (e.g., "/api/default/connectors" -> "connectors")
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(pathParts) >= 3 {
			endpoint := pathParts[2] // Should be "connectors" or "connector-plugins"
			targetURL = fmt.Sprintf("%s/%s", connectURL, endpoint)
		} else {
			targetURL = fmt.Sprintf("%s/connectors", connectURL) // fallback
		}
	} else {
		// For paths like "datagen-users" or "datagen-users/status", we need to determine the base endpoint
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(pathParts) >= 3 {
			endpoint := pathParts[2] // Should be "connectors" or "connector-plugins"
			targetURL = fmt.Sprintf("%s/%s/%s", connectURL, endpoint, path)
		} else {
			targetURL = fmt.Sprintf("%s/connectors/%s", connectURL, path) // fallback
		}
	}

	log.Printf("Proxying %s %s to %s", r.Method, r.URL.Path, targetURL)

	// Create the proxy request
	proxyReq, err := http.NewRequest(r.Method, targetURL, r.Body)
	if err != nil {
		http.Error(w, "Failed to create proxy request", http.StatusInternalServerError)
		log.Printf("Error creating proxy request: %v", err)
		return
	}

	// Copy headers
	for key, values := range r.Header {
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}

	// Make the request
	client := &http.Client{}
	resp, err := client.Do(proxyReq)
	if err != nil {
		http.Error(w, "Failed to proxy request", http.StatusBadGateway)
		log.Printf("Error proxying request: %v", err)
		return
	}
	defer resp.Body.Close()

	// Read the response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read response", http.StatusInternalServerError)
		log.Printf("Error reading response: %v", err)
		return
	}

	// If response is JSON, redact sensitive data
	var jsonData interface{}
	if err := json.Unmarshal(body, &jsonData); err == nil {
		redacted := redactSensitiveData(jsonData)
		redactedBody, err := json.Marshal(redacted)
		if err != nil {
			http.Error(w, "Failed to marshal redacted data", http.StatusInternalServerError)
			log.Printf("Error marshaling redacted data: %v", err)
			return
		}
		body = redactedBody
	}

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Set status code and write response
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
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
	_ = vars["cluster"]

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
