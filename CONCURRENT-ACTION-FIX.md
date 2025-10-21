# Fix: Prevent Concurrent Connector Actions

## Problem

The initial implementation of action-specific loading states had a critical race condition bug:

- `actionLoading` was a string (`'pause'`, `'resume'`, `'restart'`, `'delete'`) 
- Only the active button was disabled: `disabled={actionLoading === 'pause'}`
- **Other buttons remained enabled** during the operation
- Users could click multiple action buttons before the first request completed
- Subsequent clicks would:
  - Overwrite `actionLoading` 
  - Remove the first spinner prematurely
  - Fire overlapping requests against the same connector
  - Cause UI and backend state to become out of sync

## Solution

Changed all action button `disabled` props to check if **any** action is in progress:

```tsx
// Before (BUGGY - only disables the active button)
<LoadingButton
  disabled={status?.connector.state === 'PAUSED'}
  loading={actionLoading === 'pause'}
  // ...
/>

// After (FIXED - disables all buttons during any action)
<LoadingButton
  disabled={status?.connector.state === 'PAUSED' || actionLoading !== null}
  loading={actionLoading === 'pause'}
  // ...
/>
```

### Changes Made

#### `web/app/connectors/[name]/page.tsx`

All four action buttons now include `actionLoading !== null` in their disabled condition:

1. **Pause button**: `disabled={status?.connector.state === 'PAUSED' || actionLoading !== null}`
2. **Resume button**: `disabled={status?.connector.state !== 'PAUSED' || actionLoading !== null}`
3. **Restart button**: `disabled={actionLoading !== null}`
4. **Delete button**: `disabled={actionLoading !== null}`

This ensures **all buttons are disabled whenever any action is in progress**, preventing concurrent operations.

## Testing

### New Test Added

`web/__tests__/ConnectorDetail.test.tsx` - Test: "disables all action buttons when any action is in progress"

This test verifies:
1. Initially, only Resume is disabled (connector is RUNNING)
2. After clicking Pause, all buttons become disabled
3. No other action can be triggered while Pause is in progress

### Test Results

```
Test Suites: 13 passed, 13 total
Tests:       129 passed, 129 total (includes new test)
```

## Behavior

### Before Fix
- Click "Pause" → Pause button shows spinner, but Resume/Restart/Delete remain clickable
- Click "Delete" while Pause is running → Delete overwrites loading state, both requests run simultaneously
- **Result**: Race conditions, state synchronization issues

### After Fix
- Click "Pause" → **All buttons are disabled** 
- Loading spinner shows only on Pause button
- Other buttons show disabled state but no spinner
- User must wait for Pause to complete before performing another action
- **Result**: No race conditions, guaranteed sequential operations

## Technical Notes

- The `loading` prop still controls which button shows the spinner
- The `disabled` prop now guards **all** buttons during any operation
- State-specific disabled logic (e.g., Resume disabled when RUNNING) is preserved via OR conditions
- No breaking changes to component API or existing functionality
