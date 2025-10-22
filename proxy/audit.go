package main

import (
	"sync"
	"time"
)

// AuditLogEntry represents a single audit log entry
type AuditLogEntry struct {
	ID           string                 `json:"id"`
	Timestamp    time.Time              `json:"timestamp"`
	Action       string                 `json:"action"` // CREATE, UPDATE, DELETE, PAUSE, RESUME, RESTART
	ConnectorName string                `json:"connectorName"`
	User         string                 `json:"user,omitempty"`
	SourceIP     string                 `json:"sourceIp"`
	Changes      map[string]interface{} `json:"changes,omitempty"` // Configuration diff
	Status       string                 `json:"status"`            // SUCCESS, FAILED
	ErrorMessage string                 `json:"errorMessage,omitempty"`
}

// AuditLogger manages audit log storage
type AuditLogger struct {
	mu      sync.RWMutex
	entries []AuditLogEntry
	maxSize int
}

// NewAuditLogger creates a new audit logger with specified max size
func NewAuditLogger(maxSize int) *AuditLogger {
	return &AuditLogger{
		entries: make([]AuditLogEntry, 0, maxSize),
		maxSize: maxSize,
	}
}

// Log adds a new audit log entry
func (a *AuditLogger) Log(entry AuditLogEntry) {
	a.mu.Lock()
	defer a.mu.Unlock()

	// Generate ID if not provided
	if entry.ID == "" {
		entry.ID = generateAuditID(entry.Timestamp, entry.ConnectorName, entry.Action)
	}

	// Set timestamp if not provided
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}

	// Add entry to the beginning (newest first)
	a.entries = append([]AuditLogEntry{entry}, a.entries...)

	// Enforce max size (remove oldest entries if needed)
	if len(a.entries) > a.maxSize {
		a.entries = a.entries[:a.maxSize]
	}
}

// GetAll returns all audit log entries
func (a *AuditLogger) GetAll() []AuditLogEntry {
	a.mu.RLock()
	defer a.mu.RUnlock()

	// Return a copy to prevent external modification
	result := make([]AuditLogEntry, len(a.entries))
	copy(result, a.entries)
	return result
}

// GetFiltered returns audit log entries matching the given filters
func (a *AuditLogger) GetFiltered(connector, action, status string, since, until time.Time, limit int) []AuditLogEntry {
	a.mu.RLock()
	defer a.mu.RUnlock()

	result := make([]AuditLogEntry, 0)

	for _, entry := range a.entries {
		// Apply filters
		if connector != "" && entry.ConnectorName != connector {
			continue
		}
		if action != "" && entry.Action != action {
			continue
		}
		if status != "" && entry.Status != status {
			continue
		}
		if !since.IsZero() && entry.Timestamp.Before(since) {
			continue
		}
		if !until.IsZero() && entry.Timestamp.After(until) {
			continue
		}

		result = append(result, entry)

		// Apply limit
		if limit > 0 && len(result) >= limit {
			break
		}
	}

	return result
}

// generateAuditID creates a unique ID for an audit entry
func generateAuditID(timestamp time.Time, connector, action string) string {
	// Use timestamp + connector + action for a unique ID
	return timestamp.Format("20060102150405.000000") + "-" + connector + "-" + action
}
