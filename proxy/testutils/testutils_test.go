package testutils

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type sample struct {
	Name string `json:"name"`
}

func TestLoadFixtureHelpers(t *testing.T) {
	data := LoadFixture(t, "connector-status.json")
	if len(data) == 0 {
		t.Fatalf("expected fixture to be loaded")
	}

	var payload sample
	LoadJSONFixture(t, "connector-status.json", &payload)
	if payload.Name == "" {
		t.Fatalf("expected JSON fixture to populate struct")
	}
}

func TestNewTestClientAppliesTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewTestClient(server)
	if client.Timeout <= 0 {
		t.Fatalf("expected timeout to be configured")
	}

	if _, err := client.Get(server.URL); err != nil {
		t.Fatalf("expected client to make successful request: %v", err)
	}
}

func TestConnectServerRecordsRequests(t *testing.T) {
	responses := map[string]Response{
		"POST /example": {
			Status:  http.StatusCreated,
			Body:    map[string]string{"status": "ok"},
			Headers: map[string]string{"X-Test": "1"},
		},
	}

	server := NewConnectServer(responses)
	defer server.Close()

	req, err := http.NewRequest(http.MethodPost, server.URL()+"/example", strings.NewReader(`{"hello":"world"}`))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed to call test server: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	if resp.Header.Get("X-Test") != "1" {
		t.Fatalf("expected header X-Test to be propagated")
	}

	requests := server.Requests()
	if len(requests) != 1 {
		t.Fatalf("expected 1 recorded request, got %d", len(requests))
	}
	if requests[0].Method != http.MethodPost || requests[0].Path != "/example" {
		t.Fatalf("unexpected recorded request: %+v", requests[0])
	}
}

func TestNewConnectServerWithTB(t *testing.T) {
	responses := map[string]MockResponse{
		"/status": {Body: []byte("hello"), Headers: map[string]string{"X-Test": "1"}, Methods: []string{"GET"}},
	}

	server := NewConnectServerWithTB(t, responses)
	resp, err := http.Get(server.URL + "/status")
	if err != nil {
		t.Fatalf("failed to GET from server: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	if resp.Header.Get("X-Test") != "1" {
		t.Fatalf("expected header propagation from mock response")
	}
}

func TestNewJSONConnectServerWithTB(t *testing.T) {
	payload := map[string]interface{}{"status": "ok"}
	body, _ := json.Marshal(payload)
	server := NewJSONConnectServerWithTB(t, map[string]MockResponse{"/status": {Body: body}})
	resp, err := http.Get(server.URL + "/status")
	if err != nil {
		t.Fatalf("failed to GET from JSON server: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var decoded map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		t.Fatalf("failed to decode JSON response: %v", err)
	}
	if decoded["status"] != "ok" {
		t.Fatalf("expected JSON response to contain status, got %v", decoded)
	}
}
