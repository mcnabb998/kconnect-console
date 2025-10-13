package main

import (
	"encoding/json"
	"testing"
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
