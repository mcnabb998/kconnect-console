package testutils

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// MockResponse defines the payload returned by a mock Kafka Connect server.
type MockResponse struct {
	// Status is the HTTP status code returned to the client. Defaults to 200.
	Status int
	// Body is the raw response payload returned to the client.
	Body []byte
	// Headers contains HTTP headers that should be set on the response.
	Headers map[string]string
	// Methods restricts the HTTP methods that this response will accept.
	// If empty, all methods are allowed.
	Methods []string
}

// NewConnectServer spins up an httptest.Server with deterministic responses for the
// provided route map. Each key should be an absolute path (e.g. "/connectors/foo/status").
//
// If a request does not match any provided route a 404 will be returned. When Methods
// is provided, any request using a different verb receives a 405 response.
func NewConnectServerWithTB(t testing.TB, routes map[string]MockResponse) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()
	for path, resp := range routes {
		path := path
		response := resp
		allowedMethods := make(map[string]struct{}, len(response.Methods))
		for _, method := range response.Methods {
			allowedMethods[strings.ToUpper(method)] = struct{}{}
		}

		mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
			if len(allowedMethods) > 0 {
				if _, ok := allowedMethods[r.Method]; !ok {
					w.WriteHeader(http.StatusMethodNotAllowed)
					return
				}
			}

			for key, value := range response.Headers {
				w.Header().Set(key, value)
			}

			status := response.Status
			if status == 0 {
				status = http.StatusOK
			}
			w.WriteHeader(status)
			if len(response.Body) > 0 {
				_, _ = w.Write(response.Body)
			}
		})
	}

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})

	return httptest.NewServer(mux)
}

// NewJSONConnectServer is a convenience wrapper around NewConnectServer that sets the
// Content-Type header to application/json for all responses.
func NewJSONConnectServerWithTB(t testing.TB, routes map[string]MockResponse) *httptest.Server {
	t.Helper()

	for path, resp := range routes {
		if resp.Headers == nil {
			resp.Headers = map[string]string{"Content-Type": "application/json"}
		} else if _, ok := resp.Headers["Content-Type"]; !ok {
			resp.Headers["Content-Type"] = "application/json"
		}
		routes[path] = resp
	}

	return NewConnectServerWithTB(t, routes)
}
