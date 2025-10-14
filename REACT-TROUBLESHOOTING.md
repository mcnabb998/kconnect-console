# React Troubleshooting Guide

This document explains how to troubleshoot React issues in the kconnect-console web UI.

## Enabled Features

### 1. React Strict Mode
React Strict Mode is enabled in `web/next.config.js` to help identify potential problems:
- Warns about unsafe lifecycle methods
- Detects legacy string ref API usage
- Warns about deprecated findDOMNode usage
- Detects unexpected side effects
- Detects legacy context API

**In development, Strict Mode intentionally double-invokes:**
- Component constructors
- `render` method
- `useState`, `useMemo`, `useReducer` functions

This helps surface side effects. If you see duplicate console logs in development, this is expected behavior.

### 2. Error Boundary
An `ErrorBoundary` component wraps the entire app in `web/app/layout.tsx`. When a React component throws an error, you'll see:
- A user-friendly error screen
- The error message
- Full stack trace (expandable)
- "Try Again" button to reset the error boundary
- "Go Home" button to return to the homepage
- Troubleshooting tips specific to this app

**Error boundary location:** `web/app/components/ErrorBoundary.tsx`

### 3. Console Preservation
The config preserves `console.error` and `console.warn` in production builds, so you can still debug production issues via browser DevTools.

## Debugging Workflow

### Step 1: Check Browser Console (F12)
1. Open DevTools (F12 or right-click → Inspect)
2. Go to the Console tab
3. Look for:
   - Red error messages
   - Yellow warnings
   - Network failures (filtered by XHR/Fetch)

### Step 2: Use React DevTools
Install React DevTools browser extension:
- Chrome: https://chrome.google.com/webstore (search "React Developer Tools")
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/react-devtools/

**What to check:**
- Component tree structure
- Props passed to components
- State values
- Hooks (useState, useEffect, etc.)
- Performance profiling

### Step 3: Check Network Requests
In DevTools Network tab:
1. Filter by "Fetch/XHR"
2. Look for failed requests to:
   - `http://localhost:8080/api/default/*` (proxy)
   - `http://localhost:8080/health` (health check)
3. Check response status codes:
   - 404: Endpoint not found
   - 500: Server error (check proxy logs)
   - Network error: Service not running

### Step 4: Verify Services
Ensure all required services are running:

```powershell
# Check Docker containers
cd compose
docker compose ps

# Expected services:
# - zookeeper (port 2181)
# - kafka (port 9092)
# - kafka-connect (port 8083)
# - kconnect-proxy (port 8080)
# - kconnect-web (port 3000)
```

### Step 5: Check Service Logs
```powershell
# All services
cd compose
docker compose logs -f

# Specific service
docker compose logs -f kconnect-proxy
docker compose logs -f kconnect-web
docker compose logs -f kafka-connect
```

### Step 6: Test Proxy Directly
```powershell
# Health check
Invoke-RestMethod -Uri http://localhost:8080/health

# List connectors
Invoke-RestMethod -Uri http://localhost:8080/api/default/connectors

# List plugins
Invoke-RestMethod -Uri http://localhost:8080/api/default/connector-plugins
```

## Common Issues

### Issue: "Cannot read property of undefined"
**Cause:** Component receiving unexpected data structure

**Debug:**
1. Open React DevTools
2. Find the failing component
3. Check props values
4. Verify API response structure in Network tab

**Fix:** Add null checks or optional chaining (`?.`)

### Issue: "Failed to fetch"
**Cause:** Proxy service not running or wrong URL

**Debug:**
1. Check proxy health: `http://localhost:8080/health`
2. Verify `NEXT_PUBLIC_PROXY_URL` in `web/lib/api.ts`
3. Check Docker containers are running

**Fix:** Start services with `docker compose up -d` in `compose/`

### Issue: Blank page with no errors
**Cause:** JavaScript error before React renders

**Debug:**
1. Open browser console (F12)
2. Look for syntax errors or module load failures
3. Check Network tab for failed JS bundle loads

**Fix:** Clear browser cache, rebuild with `npm run build`

### Issue: "Hydration failed"
**Cause:** Server-rendered HTML doesn't match client render

**Debug:**
1. Check for dynamic content that differs between server/client
2. Look for browser-only APIs used during SSR
3. Check for random values or dates without stable keys

**Fix:** 
- Use `'use client'` directive for components with browser APIs
- Use `useEffect` for browser-only logic
- Ensure consistent rendering between server/client

### Issue: Component not updating
**Cause:** State management issue or missing dependency

**Debug:**
1. Open React DevTools
2. Check component state values
3. Verify props are changing
4. Check useEffect dependency arrays

**Fix:** Add missing dependencies to `useEffect` arrays

## Error Boundary Testing

To test the error boundary, create a component that throws:

```tsx
'use client';

export function TestError() {
  throw new Error('Test error for troubleshooting');
  return <div>This won't render</div>;
}
```

Add it to any page temporarily and you'll see the error boundary UI.

## Additional Resources

- Next.js Debugging: https://nextjs.org/docs/app/building-your-application/configuring/debugging
- React DevTools: https://react.dev/learn/react-developer-tools
- React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- Browser DevTools:
  - Chrome: https://developer.chrome.com/docs/devtools/
  - Firefox: https://firefox-source-docs.mozilla.org/devtools-user/

## Getting Help

When reporting an issue, include:
1. Error message (from error boundary or console)
2. Full stack trace
3. Steps to reproduce
4. Browser and version
5. Whether services are running (`docker compose ps` output)
6. Relevant network requests (from Network tab)
7. Component state/props (from React DevTools screenshot)
