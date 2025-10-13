package testutils

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
)

// Response represents a mocked Kafka Connect response specification.
type Response struct {
	Status  int
	Body    interface{}
	Headers map[string]string
}

// Request captures details about a request received by the mocked Kafka Connect server.
type Request struct {
	Method string
	Path   string
	Header http.Header
	Body   []byte
}

// ConnectServer simulates a Kafka Connect endpoint for proxy tests.
type ConnectServer struct {
	server    *httptest.Server
	mu        sync.Mutex
	requests  []Request
	responses map[string]Response
}

// NewConnectServer spins up an HTTP server that returns predefined responses per method + path.
func NewConnectServer(responses map[string]Response) *ConnectServer {
	cs := &ConnectServer{
		responses: responses,
	}

	cs.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		r.Body.Close()

		cs.mu.Lock()
		cs.requests = append(cs.requests, Request{
			Method: r.Method,
			Path:   r.URL.Path,
			Header: r.Header.Clone(),
			Body:   body,
		})
		cs.mu.Unlock()

		key := r.Method + " " + r.URL.Path
		resp, ok := cs.responses[key]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		for header, value := range resp.Headers {
			w.Header().Set(header, value)
		}

		status := resp.Status
		if status == 0 {
			status = http.StatusOK
		}

		w.WriteHeader(status)

		switch body := resp.Body.(type) {
		case nil:
			return
		case []byte:
			w.Write(body)
		default:
			if err := json.NewEncoder(w).Encode(body); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
		}
	}))

	return cs
}

// URL returns the base URL of the mocked Kafka Connect server.
func (cs *ConnectServer) URL() string {
	return cs.server.URL
}

// Close shuts down the mocked Kafka Connect server.
func (cs *ConnectServer) Close() {
	cs.server.Close()
}

// Requests returns a snapshot of the requests received by the mocked server.
func (cs *ConnectServer) Requests() []Request {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	out := make([]Request, len(cs.requests))
	copy(out, cs.requests)
	return out
}
