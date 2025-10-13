package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

var (
	connectURL       = getEnv("KAFKA_CONNECT_URL", "http://localhost:8083")
	sensitivePattern = regexp.MustCompile(`(?i)(password|secret|token|key|credential|auth)`)
)

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
			if sensitivePattern.MatchString(key) {
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

	// Build the target URL - handle empty path case
	var targetURL string
	if path == "" {
		targetURL = fmt.Sprintf("%s/connectors", connectURL)
	} else {
		targetURL = fmt.Sprintf("%s/%s", connectURL, path)
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

func main() {
	router := mux.NewRouter()

	// Health check endpoint
	router.HandleFunc("/health", healthHandler).Methods("GET")

	// Proxy routes for Kafka Connect
	router.HandleFunc("/api/{cluster}/connectors", proxyHandler).Methods("GET", "POST")
	router.HandleFunc("/api/{cluster}/connectors/", proxyHandler).Methods("GET", "POST")
	router.HandleFunc("/api/{cluster}/{path:.*}", proxyHandler).Methods("GET", "POST", "PUT", "DELETE")

	// CORS configuration
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(router)

	port := getEnv("PORT", "8080")
	log.Printf("Starting proxy server on port %s", port)
	log.Printf("Forwarding to Kafka Connect at %s", connectURL)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
