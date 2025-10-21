# Development & Testing Guide

This document describes how to run tests locally to ensure your changes will pass the CI/CD pipeline.

## 🚀 Quick Start - Before Every Commit

**Windows (PowerShell):**
```powershell
.\scripts\pre-commit-check.ps1
```

**Linux/Mac:**
```bash
./scripts/pre-commit-check.sh
```

This runs ALL pipeline checks in ~2-3 minutes and ensures your commit will pass CI/CD.

---

## 📋 Individual Test Commands

### Frontend (React/Next.js)

```bash
cd web

# Run tests
npm test                    # Interactive mode
npm run test:ci             # CI mode (with coverage)

# Type checking
npm run typecheck           # TypeScript compiler check

# Linting
npm run lint                # Check for lint errors
npm run lint:fix            # Auto-fix lint errors

# Build
npm run build               # Production build

# Run all checks at once
npm run validate            # typecheck + lint + test + build
```

### Backend (Go)

```bash
cd proxy

# Run tests
go test -v ./...            # All tests with verbose output
go test -v -cover ./...     # With coverage

# Formatting
gofmt -s -l .              # Check formatting (should output nothing)
gofmt -s -w .              # Auto-fix formatting

# Linting
go vet ./...               # Static analysis
```

---

## 🔄 CI/CD Pipeline Overview

The GitHub Actions pipeline runs on every push:

### Jobs

1. **go-tests** - Go unit tests with coverage
2. **react-tests** - React/TypeScript tests with coverage
3. **integration-tests** - Docker Compose + API tests
4. **lint** - Go formatting, go vet, TypeScript, ESLint

### What Gets Checked

✅ All unit tests pass
✅ Code coverage maintained
✅ No TypeScript errors
✅ No ESLint warnings
✅ Go code properly formatted
✅ Production build succeeds
✅ Integration tests pass

---

## 🎯 My Development Workflow (Recommended)

### 1. Before Starting
```bash
git pull
cd web && npm install
cd ../proxy && go mod download
```

### 2. While Developing
```bash
# Run tests in watch mode
cd web && npm test
```

### 3. Before Each Commit
```bash
# Windows
.\scripts\pre-commit-check.ps1

# Linux/Mac
./scripts/pre-commit-check.sh
```

This is the CRITICAL step that prevents pipeline failures!

### 4. If Pipeline Fails
1. Check the GitHub Actions logs
2. Run the failing command locally
3. Fix the issue
4. Re-run pre-commit-check script
5. Commit the fix

---

## ✅ Pre-Commit Checklist

Before EVERY commit:

- [ ] Run `.\scripts\pre-commit-check.ps1` and all checks pass
- [ ] Or manually verify:
  - [ ] Tests pass: `npm test` (web), `go test ./...` (proxy)
  - [ ] Lint passes: `npm run lint` (web)
  - [ ] TypeScript passes: `npm run typecheck` (web)
  - [ ] Go formatting: `gofmt -s -l .` (proxy) returns nothing
  - [ ] Build succeeds: `npm run build` (web)

---

## 🐛 Common Issues & Fixes

### ESLint: "rule not found" error
**Fix:** Check `.eslintrc.json` for valid rules. Don't use eslint-disable comments with non-existent rules.

### Tests: "act(...)" warnings
**Fix:** Wrap timer/state updates in `act()`:
```typescript
act(() => {
  jest.advanceTimersByTime(1000);
});
```

### Tests pass locally, fail in CI
**Common causes:**
- Missing mocks for Next.js hooks (`useSearchParams`, `useRouter`)
- Timers not cleaned up
- Race conditions

**Fix:** Run `npm run test:ci` to match CI environment

### Build fails but dev works
**Fix:** Run `npm run build` locally. Common issues:
- Missing Suspense boundary
- Server/client component issues

---

## 📝 Writing Tests

### Test Structure
```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup mocks
  });

  it('should do something specific', async () => {
    // Arrange
    const component = render(<MyComponent />);

    // Act
    await userEvent.click(screen.getByRole('button'));

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Result')).toBeInTheDocument();
    });
  });
});
```

### Coverage Goals
- **Minimum:** 70%
- **Target:** 80%
- **New Features:** >80%

---

## 🔧 Troubleshooting

### "Cannot find module" errors in tests
```bash
cd web && npm install
```

### Go module issues
```bash
cd proxy && go mod tidy
```

### Stale build artifacts
```bash
cd web
rm -rf .next node_modules
npm install
npm run build
```

---

## 📚 Resources

- [GitHub Actions Workflow](.github/workflows/test.yml)
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Go Testing](https://go.dev/doc/tutorial/add-a-test)
