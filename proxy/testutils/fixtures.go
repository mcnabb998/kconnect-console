package testutils

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

// LoadFixture reads a file from the proxy/testdata directory and returns its raw bytes.
func LoadFixture(t testing.TB, filename string) []byte {
	t.Helper()

	path := filepath.Join(testdataDir(t), filename)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read fixture %q: %v", filename, err)
	}

	return data
}

// LoadJSONFixture reads a JSON fixture from proxy/testdata and unmarshals it into the
// provided value.
func LoadJSONFixture(t testing.TB, filename string, v interface{}) {
	t.Helper()

	data := LoadFixture(t, filename)
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("failed to unmarshal fixture %q: %v", filename, err)
	}
}

// NewTestClient returns an HTTP client configured for interacting with the provided
// httptest.Server. A short timeout is applied to keep tests responsive.
func NewTestClient(server *httptest.Server) *http.Client {
	client := server.Client()
	client.Timeout = 5 * time.Second
	return client
}

func testdataDir(t testing.TB) string {
	t.Helper()

	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatalf("unable to resolve caller information for fixture loading")
	}

	return filepath.Join(filepath.Dir(currentFile), "..", "testdata")
}
