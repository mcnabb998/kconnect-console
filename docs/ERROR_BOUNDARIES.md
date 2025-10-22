# Error Boundaries in kconnect-console

## Overview

This application implements a multi-layered error boundary strategy to ensure that component errors don't crash the entire application. When an error occurs in one section, only that section shows an error message while the rest of the page continues to function normally.

## Architecture

### Two-Layer Error Boundary Strategy

1. **Global Error Boundary** (`ErrorBoundary`)
   - Wraps the entire application in `layout.tsx`
   - Catches catastrophic errors that escape section boundaries
   - Shows full-page error UI with detailed troubleshooting information
   - Last line of defense before the entire app crashes

2. **Section Error Boundaries** (`SectionErrorBoundary`)
   - Wraps individual sections and components
   - Shows compact error UI within the section
   - Allows rest of the page to continue functioning
   - Provides retry mechanism for failed sections

## Usage

### SectionErrorBoundary Component

```tsx
import { SectionErrorBoundary } from '@/app/components/SectionErrorBoundary';

function MyPage() {
  return (
    <div>
      <SectionErrorBoundary section="Navigation">
        <Navigation />
      </SectionErrorBoundary>
      
      <SectionErrorBoundary section="Main Content">
        <MainContent />
      </SectionErrorBoundary>
    </div>
  );
}
```

### Props

- `section` (optional): Name of the section for error messages (default: "section")
- `fallback` (optional): Custom error UI render function
- `children`: Components to protect with error boundary

### Custom Fallback Example

```tsx
<SectionErrorBoundary
  section="User Profile"
  fallback={(error, reset) => (
    <div className="error-container">
      <h3>Failed to load user profile</h3>
      <p>{error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
>
  <UserProfile />
</SectionErrorBoundary>
```

## Where Error Boundaries Are Used

### Layout Level
- **Navigation Sidebar**: Prevents navigation errors from breaking the app
- **Page Content**: Wraps all page content to isolate page-level errors

### Page Level

#### Monitoring Page
- **Monitoring Header**: Header with cluster info and controls
- **Summary Cards**: Four metric cards (Total, Running, Degraded, Failed)
- **Alert Banner**: Failure alert message
- **Connectors Table**: Table of all connectors
- **Connectors Overview**: Desktop view connector list
- **Problems Panel**: Sidebar showing failed connectors

#### Connectors List Page
- **Page Header**: Title and create button
- **Connectors List**: Grid of connector cards

#### Connector Detail Page
- **Connector Header**: Breadcrumb, name, and status badge
- **Action Buttons**: Pause, Resume, Restart, Delete buttons
- **Status Details**: Connector and task status information
- **Configuration**: Connector configuration JSON
- **Transformations Tab**: SMT configuration interface

## Error Boundary Behavior

### When an Error Occurs

1. **Error is caught** by the nearest error boundary
2. **Console logging** - Error details logged with section name
3. **UI update** - Section shows compact error message
4. **Rest of page** continues functioning normally
5. **User can retry** - "Try Again" button resets the error state

### Error UI Features

- 🔴 Red border and background for visibility
- ⚠️ Error icon for quick identification
- 📝 Clear error message
- 🔄 "Try Again" button to retry rendering
- 📋 "Show Details" collapsible for stack trace
- ♿ Accessible with proper ARIA labels

## Best Practices

### When to Add Error Boundaries

✅ **DO wrap:**
- Independent page sections (header, content, sidebar)
- Data tables and lists
- Form sections
- Complex interactive components
- Third-party component integrations

❌ **DON'T wrap:**
- Individual buttons or links
- Simple text displays
- Every single component (over-engineering)
- Components that share critical state

### Naming Sections

Use clear, user-friendly names:
```tsx
// Good
<SectionErrorBoundary section="Connector Status">
<SectionErrorBoundary section="Action Buttons">
<SectionErrorBoundary section="Configuration Panel">

// Not as good
<SectionErrorBoundary section="div-1">
<SectionErrorBoundary section="component">
```

### Testing Error Boundaries

```tsx
// Test component that throws an error
const ThrowError = () => {
  throw new Error('Test error');
};

test('error boundary catches errors', () => {
  render(
    <SectionErrorBoundary section="Test">
      <ThrowError />
    </SectionErrorBoundary>
  );
  
  expect(screen.getByText(/Error loading Test/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
});
```

## Monitoring and Debugging

### Console Logs

All errors caught by error boundaries are logged to the console with:
- Section name
- Error message
- Component stack trace

Example:
```
SectionErrorBoundary caught an error in Navigation Panel: TypeError: Cannot read property 'map' of undefined
```

### Stack Traces

Stack traces are available in:
1. Browser console (always)
2. "Show Details" dropdown in error UI (production)

## Future Improvements

Potential enhancements to consider:

1. **Error Reporting Service**
   - Send errors to monitoring service (Sentry, DataDog, etc.)
   - Track error rates and patterns
   - Alert on critical failures

2. **Retry Logic**
   - Automatic retry with exponential backoff
   - Maximum retry attempts
   - Different retry strategies per section

3. **Graceful Degradation**
   - Show cached data when fresh data fails
   - Fallback to simpler UI when complex component fails
   - Progressive enhancement based on capabilities

4. **User Feedback**
   - "Report Problem" button
   - Error feedback form
   - User context capture

## Related Files

- `/web/app/components/ErrorBoundary.tsx` - Global error boundary
- `/web/app/components/SectionErrorBoundary.tsx` - Section error boundary
- `/web/app/layout.tsx` - Root layout with error boundaries
- `/web/__tests__/SectionErrorBoundary.test.tsx` - Error boundary tests

## Resources

- [React Error Boundaries Documentation](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Error Boundary Best Practices](https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react)
