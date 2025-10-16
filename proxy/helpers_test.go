package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestNormalizeState(t *testing.T) {
	tests := map[string]string{
		"running":    "running",
		"RUNNING":    "running",
		"Paused":     "paused",
		"FAILED":     "failed",
		"Unassigned": "unassigned",
		"unknown":    "unknown",
	}

	for input, expected := range tests {
		if got := normalizeState(input); got != expected {
			t.Fatalf("normalizeState(%q) = %q, want %q", input, got, expected)
		}
	}
}

func TestConnectUnavailableErrorUnwrap(t *testing.T) {
	inner := errors.New("boom")
	cue := &connectUnavailableError{err: inner}
	if !errors.Is(cue, inner) {
		t.Fatalf("expected errors.Is to match inner error")
	}
	if cue.Unwrap() != inner {
		t.Fatalf("expected Unwrap to return original error")
	}
}

func TestJoinURL(t *testing.T) {
	tests := []struct {
		base     string
		parts    []string
		expected string
	}{
		{"http://localhost:8083", []string{"connectors"}, "http://localhost:8083/connectors"},
		{"http://localhost:8083/", []string{"connectors", "alpha"}, "http://localhost:8083/connectors/alpha"},
		{"http://localhost:8083", []string{"", "status"}, "http://localhost:8083/status"},
	}

	for _, tt := range tests {
		if got := joinURL(tt.base, tt.parts...); got != tt.expected {
			t.Fatalf("joinURL(%q, %v) = %q, want %q", tt.base, tt.parts, got, tt.expected)
		}
	}
}

func TestCopyHeaders(t *testing.T) {
	src := http.Header{}
	src.Add("Content-Type", "application/json")
	src.Add("X-Custom", "a")
	src.Add("X-Custom", "b")
	src.Add("Host", "example")
	src.Add("Content-Length", "42")

	dst := http.Header{}
	dst.Add("X-Custom", "old")

	copyHeaders(dst, src)

	if dst.Get("Host") != "" {
		t.Fatalf("expected Host header to be skipped, got %q", dst.Get("Host"))
	}
	if dst.Get("Content-Length") != "" {
		t.Fatalf("expected Content-Length header to be skipped, got %q", dst.Get("Content-Length"))
	}

	values := dst.Values("X-Custom")
	if len(values) != 2 || values[0] != "a" || values[1] != "b" {
		t.Fatalf("unexpected X-Custom values: %v", values)
	}
}

func TestWriteRedactedResponse(t *testing.T) {
	body := map[string]interface{}{
		"password":      "secret",
		"key.converter": "allowed",
	}
	raw, _ := json.Marshal(body)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}, "Content-Length": []string{"999"}},
		Body:       io.NopCloser(bytes.NewReader(raw)),
	}

	rr := httptest.NewRecorder()
	if err := writeRedactedResponse(rr, resp); err != nil {
		t.Fatalf("writeRedactedResponse returned error: %v", err)
	}

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	if rr.Header().Get("Content-Length") != "" {
		t.Fatalf("expected Content-Length header to be stripped")
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if decoded["password"] != "***REDACTED***" {
		t.Fatalf("expected password to be redacted, got %v", decoded["password"])
	}
	if decoded["key.converter"] != "allowed" {
		t.Fatalf("expected key.converter to remain unchanged, got %v", decoded["key.converter"])
	}
}

func TestWriteRedactedResponseNonJSON(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusAccepted,
		Header:     http.Header{"Content-Type": []string{"text/plain"}},
		Body:       io.NopCloser(bytes.NewReader([]byte("ok"))),
	}

	rr := httptest.NewRecorder()
	if err := writeRedactedResponse(rr, resp); err != nil {
		t.Fatalf("writeRedactedResponse returned error: %v", err)
	}

	if rr.Body.String() != "ok" {
		t.Fatalf("expected body to remain unchanged, got %q", rr.Body.String())
	}
}

type failingReadCloser struct{}

func (failingReadCloser) Read([]byte) (int, error) { return 0, errors.New("boom") }
func (failingReadCloser) Close() error             { return nil }

func TestWriteRedactedResponseReadError(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body:       failingReadCloser{},
	}

	rr := httptest.NewRecorder()
	if err := writeRedactedResponse(rr, resp); err == nil {
		t.Fatalf("expected error when response body cannot be read")
	}
}

func TestParseMilliseconds(t *testing.T) {
	tests := []struct {
		input    interface{}
		expected int64
	}{
		{float64(1500), 1500},
		{int64(1200), 1200},
		{json.Number("900"), 900},
		{"2500ms", 2500},
		{"3s", 3000},
		{"1500", 1500},
	}

	for _, tt := range tests {
		got, err := parseMilliseconds(tt.input)
		if err != nil {
			t.Fatalf("parseMilliseconds(%v) returned error: %v", tt.input, err)
		}
		if got != tt.expected {
			t.Fatalf("parseMilliseconds(%v) = %d, want %d", tt.input, got, tt.expected)
		}
	}
}

func TestParseSeconds(t *testing.T) {
	tests := []struct {
		input    interface{}
		expected int64
	}{
		{float64(42), 42},
		{int64(15), 15},
		{json.Number("12"), 12},
		{"1500ms", 1},
		{"30s", 30},
		{"90", 90},
	}

	for _, tt := range tests {
		got, err := parseSeconds(tt.input)
		if err != nil {
			t.Fatalf("parseSeconds(%v) returned error: %v", tt.input, err)
		}
		if got != tt.expected {
			t.Fatalf("parseSeconds(%v) = %d, want %d", tt.input, got, tt.expected)
		}
	}
}

func TestParseIntErrors(t *testing.T) {
	if _, err := parseInt(""); err == nil {
		t.Fatalf("expected error for empty value")
	}
	if _, err := parseMilliseconds(struct{}{}); err == nil {
		t.Fatalf("expected error for unsupported type in parseMilliseconds")
	}
	if _, err := parseSeconds(struct{}{}); err == nil {
		t.Fatalf("expected error for unsupported type in parseSeconds")
	}
}

func TestExtractUptimeAndClusterID(t *testing.T) {
	payload := map[string]interface{}{
		"server_info": map[string]interface{}{
			"uptime_ms": json.Number("12345"),
		},
		"data": []interface{}{
			map[string]interface{}{
				"cluster": map[string]interface{}{
					"cluster-id": "main-cluster",
				},
			},
		},
	}

	if uptime, ok := extractUptimeSeconds(payload); !ok || uptime != 12 {
		t.Fatalf("expected uptime 12 seconds, got %d, ok=%v", uptime, ok)
	}

	if clusterID, ok := extractClusterID(payload); !ok || clusterID != "main-cluster" {
		t.Fatalf("expected cluster ID main-cluster, got %q, ok=%v", clusterID, ok)
	}

	payload = map[string]interface{}{
		"uptime": "42s",
	}
	if uptime, ok := extractUptimeSeconds(payload); !ok || uptime != 42 {
		t.Fatalf("expected uptime 42 seconds from uptime field, got %d", uptime)
	}

	payload = map[string]interface{}{
		"items": []interface{}{
			map[string]interface{}{
				"nested": map[string]interface{}{
					"uptime_ms": json.Number("2000"),
				},
			},
		},
	}
	if uptime, ok := extractUptimeSeconds(payload); !ok || uptime != 2 {
		t.Fatalf("expected uptime 2 seconds from nested array, got %d", uptime)
	}
}

func TestFormatUptime(t *testing.T) {
	cases := map[time.Duration]string{
		0:                                  "unknown",
		500 * time.Millisecond:             "<1s",
		5*time.Second + 2*time.Millisecond: "5s",
		2*time.Hour + 30*time.Minute + 5*time.Second: "2h 30m",
	}

	for input, expected := range cases {
		if got := formatUptime(input); got != expected {
			t.Fatalf("formatUptime(%v) = %q, want %q", input, got, expected)
		}
	}
}

func TestGetEnv(t *testing.T) {
	t.Setenv("KCONNECT_TEST", "present")
	if got := getEnv("KCONNECT_TEST", "default"); got != "present" {
		t.Fatalf("expected env override, got %q", got)
	}
	if got := getEnv("KCONNECT_MISSING", "fallback"); got != "fallback" {
		t.Fatalf("expected default fallback, got %q", got)
	}

	os.Unsetenv("KCONNECT_TEST")
}
