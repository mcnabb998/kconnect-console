package main

import (
	"testing"
	"time"
)

func TestNewAuditLogger(t *testing.T) {
	logger := NewAuditLogger(100)
	if logger == nil {
		t.Fatal("Expected non-nil logger")
	}
	if len(logger.GetAll()) != 0 {
		t.Errorf("Expected empty logger, got %d entries", len(logger.GetAll()))
	}
}

func TestAuditLogger_Log(t *testing.T) {
	logger := NewAuditLogger(10)

	entry := AuditLogEntry{
		Action:        "CREATE",
		ConnectorName: "test-connector",
		User:          "admin",
		SourceIP:      "127.0.0.1",
		Status:        "SUCCESS",
	}

	logger.Log(entry)

	entries := logger.GetAll()
	if len(entries) != 1 {
		t.Fatalf("Expected 1 entry, got %d", len(entries))
	}

	logged := entries[0]
	if logged.Action != "CREATE" {
		t.Errorf("Expected action CREATE, got %s", logged.Action)
	}
	if logged.ConnectorName != "test-connector" {
		t.Errorf("Expected connector test-connector, got %s", logged.ConnectorName)
	}
	if logged.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if logged.Timestamp.IsZero() {
		t.Error("Expected timestamp to be set")
	}
}

func TestAuditLogger_MaxSize(t *testing.T) {
	logger := NewAuditLogger(5)

	// Add 10 entries
	for i := 0; i < 10; i++ {
		logger.Log(AuditLogEntry{
			Action:        "CREATE",
			ConnectorName: "connector-" + string(rune('0'+i)),
			Status:        "SUCCESS",
		})
	}

	entries := logger.GetAll()
	if len(entries) != 5 {
		t.Errorf("Expected 5 entries (max size), got %d", len(entries))
	}

	// Verify newest entries are kept (9, 8, 7, 6, 5)
	if entries[0].ConnectorName != "connector-9" {
		t.Errorf("Expected newest entry first, got %s", entries[0].ConnectorName)
	}
}

func TestAuditLogger_GetFiltered(t *testing.T) {
	logger := NewAuditLogger(100)

	// Add test data
	now := time.Now()
	entries := []AuditLogEntry{
		{
			Action:        "CREATE",
			ConnectorName: "connector-1",
			Status:        "SUCCESS",
			Timestamp:     now.Add(-2 * time.Hour),
		},
		{
			Action:        "DELETE",
			ConnectorName: "connector-1",
			Status:        "SUCCESS",
			Timestamp:     now.Add(-1 * time.Hour),
		},
		{
			Action:        "CREATE",
			ConnectorName: "connector-2",
			Status:        "FAILED",
			Timestamp:     now.Add(-30 * time.Minute),
		},
		{
			Action:        "PAUSE",
			ConnectorName: "connector-2",
			Status:        "SUCCESS",
			Timestamp:     now,
		},
	}

	for _, entry := range entries {
		logger.Log(entry)
	}

	tests := []struct {
		name      string
		connector string
		action    string
		status    string
		limit     int
		expected  int
	}{
		{
			name:     "filter by connector",
			connector: "connector-1",
			expected: 2,
		},
		{
			name:     "filter by action",
			action:   "CREATE",
			expected: 2,
		},
		{
			name:     "filter by status",
			status:   "FAILED",
			expected: 1,
		},
		{
			name:     "filter with limit",
			limit:    2,
			expected: 2,
		},
		{
			name:      "filter multiple conditions",
			connector: "connector-2",
			status:    "SUCCESS",
			expected:  1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := logger.GetFiltered(tt.connector, tt.action, tt.status, time.Time{}, time.Time{}, tt.limit)
			if len(result) != tt.expected {
				t.Errorf("Expected %d entries, got %d", tt.expected, len(result))
			}
		})
	}
}

func TestAuditLogger_GetFilteredByTime(t *testing.T) {
	logger := NewAuditLogger(100)

	now := time.Now()
	entries := []AuditLogEntry{
		{
			Action:        "CREATE",
			ConnectorName: "old-connector",
			Status:        "SUCCESS",
			Timestamp:     now.Add(-2 * time.Hour),
		},
		{
			Action:        "CREATE",
			ConnectorName: "recent-connector",
			Status:        "SUCCESS",
			Timestamp:     now.Add(-30 * time.Minute),
		},
		{
			Action:        "CREATE",
			ConnectorName: "new-connector",
			Status:        "SUCCESS",
			Timestamp:     now,
		},
	}

	for _, entry := range entries {
		logger.Log(entry)
	}

	// Filter entries from last hour
	since := now.Add(-1 * time.Hour)
	result := logger.GetFiltered("", "", "", since, time.Time{}, 0)

	if len(result) != 2 {
		t.Errorf("Expected 2 entries from last hour, got %d", len(result))
	}
}

func TestGenerateAuditID(t *testing.T) {
	timestamp := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	id := generateAuditID(timestamp, "test-connector", "CREATE")

	if id == "" {
		t.Error("Expected non-empty ID")
	}

	// Verify ID contains timestamp, connector, and action
	if len(id) < 20 {
		t.Errorf("Expected longer ID, got %s", id)
	}
}
