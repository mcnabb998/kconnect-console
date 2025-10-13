# Contributing Guide

Thank you for your interest in contributing to kconnect-console!

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Go 1.21+ (for proxy development)
- Node.js 20+ (for web development)

### Local Development

#### Proxy Service

1. Navigate to proxy directory:
   ```bash
   cd proxy
   ```

2. Install dependencies:
   ```bash
   go mod download
   ```

3. Run tests:
   ```bash
   go test -v -cover ./...
   ```

4. Run locally:
   ```bash
   KAFKA_CONNECT_URL=http://localhost:8083 go run main.go
   ```

#### Web UI

1. Navigate to web directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

5. Run tests:
   ```bash
   npm run test -- --coverage
   ```

### Testing

Run the complete test suite:
```bash
make test
```

This will:
- Run Go proxy tests with coverage reporting
- Run web Vitest suites with coverage reporting

### Code Style

#### Go
- Follow standard Go conventions
- Run `go fmt` before committing
- Add tests for new features

#### TypeScript/React
- Use functional components with hooks
- Follow existing code style
- Use Tailwind CSS for styling

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `make test`
5. Commit with descriptive messages
6. Push to your fork
7. Create a pull request

### Adding New Features

#### Adding a New Proxy Route

1. Add route handler in `proxy/main.go`
2. Add tests in `proxy/main_test.go`
3. Update documentation in `README.md`

#### Adding a New UI Component

1. Create component in `web/app/` or `web/components/`
2. Use Tailwind CSS for styling
3. Ensure responsive design
4. Update documentation

### Debugging

#### Proxy Logs

```bash
cd compose
docker compose logs -f kconnect-proxy
```

#### Web UI Logs

```bash
cd compose
docker compose logs -f kconnect-web
```

#### Kafka Connect Logs

```bash
cd compose
docker compose logs -f kafka-connect
```

## Questions?

Feel free to open an issue for any questions or concerns.
