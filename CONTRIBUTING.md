# Contributing to kconnect-console

Thank you for your interest in contributing to kconnect-console! This guide will help you get started with development and explains our contribution process.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Code Style](#code-style)
- [Project Structure](#project-structure)
- [Getting Help](#getting-help)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Go** 1.21+
- **Docker** and Docker Compose (for local development)
- **Git**

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/kconnect-console.git
cd kconnect-console
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/mcnabb998/kconnect-console.git
```

## Development Setup

### Quick Start with Docker Compose

The easiest way to get started is using Docker Compose:

```bash
cd compose
cp .env.example .env
docker compose up
```

This starts:
- Kafka + Zookeeper
- Kafka Connect
- kconnect-console proxy (Go)
- kconnect-console web UI (Next.js)

Access the UI at http://localhost:3000

### Manual Setup

#### Backend (Go Proxy)

```bash
cd proxy
go mod download
go run main.go
```

The proxy will start on port 8080.

#### Frontend (Next.js)

```bash
cd web
npm install
npm run dev
```

The web UI will start on port 3000.

### Environment Configuration

Create a `.env` file in the `compose/` directory:

```env
KAFKA_CONNECT_URL=http://kafka-connect:8083
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_CLUSTER_ID=default
PORT=8080
ALLOWED_ORIGINS=*
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feat/your-feature-name` - New features
- `fix/issue-description` - Bug fixes
- `docs/what-you-updated` - Documentation changes
- `refactor/what-you-refactored` - Code refactoring
- `test/what-you-tested` - Test additions or updates

Example:
```bash
git checkout -b feat/add-connector-validation
```

### Commit Messages

We follow conventional commit format:

```
type(scope): subject

body

footer
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(web): add connector health status indicator

Added visual health status indicators to connector cards to show
at-a-glance status of each connector.

Closes #123
```

```
fix(proxy): handle connection timeout correctly

Previously, connection timeouts to Kafka Connect would return 500 errors.
Now returns 504 Gateway Timeout with proper error message.

Fixes #456
```

## Testing

### Backend Tests (Go)

```bash
cd proxy
go test -v ./...
```

### Frontend Tests (React)

```bash
cd web
npm test
```

Run tests with coverage:

```bash
npm test -- --coverage
```

### TypeScript Type Checking

```bash
cd web
npx tsc --noEmit
```

### Linting

```bash
cd web
npm run lint
```

### Integration Tests

Make sure Docker Compose is running:

```bash
cd compose
docker compose up -d

# Verify health
curl http://localhost:8080/health
```

### Writing Tests

- Write tests for all new features
- Ensure existing tests pass before submitting
- Aim for good coverage, especially for:
  - API endpoints
  - Business logic
  - Error handling
  - Edge cases

## Submitting Changes

### Before Submitting

1. **Run tests:**
   ```bash
   # Backend
   cd proxy && go test ./...

   # Frontend
   cd web && npm test
   ```

2. **Check formatting:**
   ```bash
   # Frontend linting
   cd web && npm run lint

   # TypeScript types
   cd web && npx tsc --noEmit
   ```

3. **Update documentation** if you changed:
   - APIs
   - Configuration options
   - Setup procedures
   - User-facing features

### Creating a Pull Request

1. **Push your branch:**
   ```bash
   git push origin feat/your-feature-name
   ```

2. **Create a Pull Request** on GitHub with:
   - Clear title describing the change
   - Description explaining what and why
   - Reference any related issues
   - Screenshots/videos for UI changes
   - Test results

3. **PR Description Template:**

```markdown
## Description
Brief description of what this PR does

## Motivation
Why is this change needed?

## Changes
- Bullet list of changes
- Made in this PR

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Tests pass
- [ ] TypeScript compiles without errors
- [ ] Linter passes
- [ ] Documentation updated
- [ ] Follows code style guidelines
```

### Review Process

- Maintainers will review your PR
- Address feedback and push updates
- Once approved, a maintainer will merge

## Code Style

### TypeScript/React

- Use TypeScript strict mode
- Functional components with hooks
- Follow existing naming conventions:
  - Components: `PascalCase`
  - Functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Types/Interfaces: `PascalCase`

**Example:**
```typescript
interface ConnectorStatus {
  name: string;
  state: 'RUNNING' | 'FAILED' | 'PAUSED';
}

export function ConnectorCard({ connector }: { connector: ConnectorStatus }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="rounded-lg border p-4">
      {/* Component content */}
    </div>
  );
}
```

### Go

- Follow standard Go conventions
- Use `gofmt` for formatting
- Use meaningful variable names
- Add comments for exported functions

**Example:**
```go
// GetConnectorStatus retrieves the current status of a connector
// from the Kafka Connect REST API.
func GetConnectorStatus(name string) (*ConnectorStatus, error) {
    resp, err := http.Get(fmt.Sprintf("%s/connectors/%s/status", baseURL, name))
    if err != nil {
        return nil, fmt.Errorf("failed to fetch status: %w", err)
    }
    defer resp.Body.Close()

    // Parse response...
}
```

### CSS/Tailwind

- Use Tailwind utility classes
- Follow existing spacing/color patterns
- Keep responsive design in mind
- Use semantic color names (e.g., `text-blue-600` for primary actions)

## Project Structure

```
kconnect-console/
├── proxy/                 # Go backend proxy
│   ├── main.go           # Entry point
│   └── *_test.go         # Test files
├── web/                  # Next.js frontend
│   ├── app/              # App router pages
│   │   ├── page.tsx      # Home page
│   │   ├── cluster/      # Cluster overview
│   │   ├── monitoring/   # Monitoring dashboard
│   │   ├── health/       # Health check page
│   │   └── connectors/   # Connector pages
│   ├── components/       # Shared components
│   └── __tests__/        # Test files
├── compose/              # Docker Compose setup
│   ├── docker-compose.yml
│   └── .env.example
├── helm/                 # Kubernetes Helm chart
│   └── kconnect-console/
└── docs/                 # Documentation
```

### Key Files

- `web/app/page.tsx` - Home page with connector list
- `web/app/connectors/[name]/page.tsx` - Connector detail page
- `web/app/monitoring/page.tsx` - Monitoring dashboard
- `web/app/health/page.tsx` - Health check dashboard
- `web/components/Navigation.tsx` - Main navigation
- `proxy/main.go` - Proxy server entry point

## Areas for Contribution

### Good First Issues

Look for issues labeled `good-first-issue`:
- Documentation improvements
- UI polish and bug fixes
- Test coverage improvements
- Small feature additions

### Feature Ideas

- Connector templates for popular sources/sinks
- Advanced monitoring and alerting
- Connector configuration validation
- Bulk operations (pause/restart multiple connectors)
- Search and filtering improvements
- Performance optimizations
- Export/import connector configurations

### Documentation

- Improve setup guides
- Add troubleshooting tips
- Create video tutorials
- Translate documentation

## Debugging

### Proxy Logs

```bash
cd compose
docker compose logs -f kconnect-proxy
```

### Web UI Logs

```bash
cd compose
docker compose logs -f kconnect-web
```

### Kafka Connect Logs

```bash
cd compose
docker compose logs -f kafka-connect
```

## Getting Help

- **GitHub Issues:** Report bugs or request features
- **Discussions:** Ask questions or discuss ideas
- **Documentation:** Check GETTING_STARTED.md and README.md

## License

By contributing to kconnect-console, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to kconnect-console! Your efforts help make Kafka Connect management better for everyone.
