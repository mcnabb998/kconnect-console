# Current Issues Status

**Last Updated:** 2025-10-21
**Total Open Issues:** 20

---

## 🔴 CRITICAL - Needs Immediate Attention

### #56 - Bug: Network error on Settings page - Failed to fetch
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** bug
**Priority:** HIGH

**Issue:**
Settings page fails to load with "Network error: Failed to fetch" when proxy service is not running or misconfigured.

**Error Location:**
- File: `lib/api.ts`
- Line: 133
- Function: `apiRequest`

**Root Cause:**
1. Proxy service not running or not accessible at configured URL
2. CORS configuration issue
3. Network connectivity problem
4. Invalid API endpoint URL

**Steps to Reproduce:**
1. Start web dev server: `npm run dev`
2. Navigate to Settings page (http://localhost:3000/settings)
3. Observe console error

**Impact:**
- Severity: High
- User Impact: Settings page completely broken
- Workaround: Ensure proxy service is running via `docker compose up`

**Next Actions:**
- [ ] Investigate why Settings page makes API call that fails
- [ ] Add proper error handling with user-friendly message
- [ ] Add health check before making API call
- [ ] Implement retry mechanism
- [ ] Add troubleshooting guidance in error message

---

## 🟠 HIGH PRIORITY - UX Improvements

### #27 - Auto-refresh on connector detail page
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** HIGH
**Estimate:** 2 hours

**Issue:**
Users must manually refresh to see status updates. Can't monitor connector recovery in real-time.

**Solution:**
Add 10-second polling with Pause/Resume toggle (same pattern as list page).

**Files to Modify:**
- `web/app/connectors/[name]/page.tsx`

**Related:**
This was identified in IMPROVEMENTS.md as a priority UX improvement.

---

### #28 - Actionable error messages with suggestions
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** HIGH
**Estimate:** 4 hours

**Issue:**
Generic "An error occurred" messages with no troubleshooting guidance.

**Solution:**
Create `ErrorDisplay` component with:
- Specific error categorization
- Actionable suggestions per error type
- Retry button where applicable
- Link to troubleshooting docs

**Files to Create:**
- `web/components/ErrorDisplay.tsx`
- `web/__tests__/ErrorDisplay.test.tsx`

**Error Types to Handle:**
- Connection refused → Check Kafka Connect URL
- Timeout → Network/firewall issues
- 404 → Connector doesn't exist
- 409 → Name conflict
- 500 → Kafka Connect internal error

---

### #29 - Network error differentiation
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** HIGH
**Estimate:** 2 hours

**Issue:**
All network errors show same generic message. Can't distinguish timeout from connection refused.

**Solution:**
Enhance `lib/fetchWithTimeout.ts` to detect and categorize:
- Connection refused → Kafka Connect not running or wrong URL
- Timeout → Network issue or firewall blocking
- DNS failure → Invalid hostname
- SSL/TLS error → Certificate issues

**Files to Modify:**
- `web/lib/fetchWithTimeout.ts`

**Files to Create:**
- `web/lib/errorCategorization.ts`

---

### #36 - Disabled button tooltips
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** HIGH
**Estimate:** 2 hours

**Issue:**
Buttons show "(unavailable)" but don't explain WHY. Identified from cluster page screenshots.

**Examples:**
- "Trigger rebalance (unavailable)" - no explanation
- "Restart all connectors (unavailable)" - no explanation
- "NOT AVAILABLE" badges - no context

**Solution:**
Add Tooltip component explaining:
- Trigger rebalance → Requires Kafka Connect 2.8+ with rebalance API
- Restart all → Feature disabled for safety
- Version requirements for unavailable features

**Files to Create:**
- `web/components/Tooltip.tsx`

**Files to Modify:**
- `web/app/cluster/page.tsx`

---

## 🟡 MEDIUM PRIORITY - Feature Enhancements

### #30 - Connector configuration editing
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** MEDIUM
**Estimate:** 8 hours

**Issue:**
Users can only view config, not edit it. Must delete and recreate to change config (risky).

**Solution:**
Add "Edit Configuration" feature with:
- Edit button on detail page
- JSON editor with syntax highlighting
- Real-time validation against plugin schema
- Preview changes before applying
- Uses PUT /connectors/{name}/config endpoint

**Files to Create:**
- `web/components/ConfigEditor.tsx`
- `web/__tests__/ConfigEditor.test.tsx`

**Files to Modify:**
- `web/app/connectors/[name]/page.tsx`

---

### #31 - Task-level restart functionality
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** MEDIUM
**Estimate:** 4 hours

**Issue:**
Can only restart entire connector, not individual failed tasks. Causes unnecessary downtime.

**Solution:**
Add restart button for individual tasks:
- Uses POST /connectors/{name}/tasks/{taskId}/restart
- Confirm dialog before restart
- Show task restart in progress

**Files to Modify:**
- `web/app/connectors/[name]/page.tsx`

---

### #32 - Connector cloning feature
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** MEDIUM
**Estimate:** 4 hours

**Issue:**
Creating similar connectors requires manual copy-paste (error-prone).

**Solution:**
Add "Clone" button that:
- Pre-fills new connector form with existing config
- Prompts for new connector name
- Allows editing before creation

---

### #33 - Bulk configuration export
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** MEDIUM
**Estimate:** 4 hours

**Issue:**
No way to export configs for backup or migration.

**Solution:**
Add "Export All" feature:
- Downloads JSON file with all connector configs
- Include metadata (creation date, status)
- Support selective export (filtered connectors)

---

### #34 - In-app help and tooltips
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** documentation, enhancement
**Priority:** MEDIUM
**Estimate:** 6 hours

**Issue:**
No inline help for complex configuration fields.

**Solution:**
Add tooltip component with:
- Field-level help text
- Examples for complex fields
- Links to relevant documentation
- Plugin-specific guidance

---

### #35 - Search/filter by plugin type
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** MEDIUM
**Estimate:** 3 hours

**Issue:**
Can only search by name, not by plugin type (source/sink) or class.

**Solution:**
Add filter dropdown:
- Filter by type (source/sink)
- Filter by plugin class
- Combine with name search
- Show plugin type badges

**Files to Modify:**
- `web/app/page.tsx`

---

### #37 - Empty state improvements
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** MEDIUM
**Estimate:** 2 hours

**Issue:**
Generic "No connectors found" message with no helpful guidance.

**Solution:**
Improve empty states:
- "Clear filters" button when filters applied
- "Create your first connector" CTA when truly empty
- Helpful text explaining the situation
- Link to getting started guide

**Files to Modify:**
- `web/app/page.tsx` (lines 573-577)

---

### #39 - Template availability UX
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** MEDIUM
**Estimate:** 2 hours

**Issue:**
Unavailable templates (missing plugins) look clickable, causing confusion.

**Solution:**
Improve unavailable template UX:
- Disable/gray out unavailable templates
- Add tooltip explaining missing plugin
- Clear visual indicator (red badge, strikethrough)
- Link to plugin installation docs

**Files to Modify:**
- `web/app/connectors/templates/page.tsx`

---

## 🔵 LOW PRIORITY - Backlog (Nice-to-Have)

### #40 - Audit log for tracking changes
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** LOW
**Estimate:** 16 hours

**Issue:**
No history of who changed what. Critical for team environments and compliance.

**Solution:**
Implement audit logging:
- Track all connector CRUD operations
- Log user/service account info
- Timestamp all changes
- Store configuration diffs
- Searchable audit log UI

---

### #41 - Connector metrics and throughput monitoring
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** LOW
**Estimate:** 20 hours

**Issue:**
No visibility into performance metrics like throughput, lag, or resource usage.

**Solution:**
Integrate JMX metrics:
- Throughput (records/sec)
- Lag metrics
- Error rates
- Resource usage (CPU, memory)
- Historical charts
- Performance alerts

---

### #42 - Connector tagging and grouping
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** LOW
**Estimate:** 8 hours

**Issue:**
No way to organize connectors into logical groups or apply tags.

**Solution:**
Add tagging system:
- Custom tags per connector
- Store tags in connector config
- Filter by tags
- Tag-based bulk operations
- Tag management UI

---

### #43 - Keyboard shortcuts for power users
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** LOW
**Estimate:** 6 hours

**Issue:**
No keyboard shortcuts. Users must use mouse for all actions.

**Solution:**
Add keyboard shortcuts:
- Cmd/Ctrl+K: Quick search
- R: Refresh
- N: New connector
- /: Focus search
- Esc: Close dialogs
- Arrow keys: Navigate list
- Enter: Open selected connector

---

### #45 - Bulk selection shortcuts
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** LOW
**Estimate:** 3 hours

**Issue:**
Can only select all or individually. No smart selection by status.

**Solution:**
Add selection shortcuts:
- Select all failed connectors
- Select all running connectors
- Select all paused connectors
- Select by type (source/sink)

**Files to Modify:**
- `web/app/page.tsx`

---

### #46 - Checkbox label associations for accessibility
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** enhancement
**Priority:** LOW
**Estimate:** 2 hours

**Issue:**
Checkboxes lack proper label associations. WCAG compliance issue.

**Solution:**
Add proper ARIA labels:
- aria-labelledby for each checkbox
- Associate with connector name
- Test with screen readers

**Files to Modify:**
- `web/app/page.tsx` (lines 459-467)

---

## 📚 DOCUMENTATION IMPROVEMENTS

### #48 - Troubleshooting guide in documentation
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** documentation
**Priority:** LOW
**Estimate:** 4 hours

**Issue:**
Missing troubleshooting guide with common scenarios and solutions.

**Solution:**
Add FAQ/Troubleshooting section to README:
- Connection issues
- Configuration errors
- Performance problems
- Debugging steps
- Common error messages
- Link to GitHub issues

**Files to Modify:**
- `README.md`

---

### #49 - API documentation for proxy endpoints
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** documentation
**Priority:** LOW
**Estimate:** 6 hours

**Issue:**
No documentation for proxy API endpoints.

**Solution:**
Create API documentation:
- Document all proxy endpoints
- Request/response examples
- Authentication details
- Error codes
- Rate limiting info
- OpenAPI/Swagger spec

**Files to Create:**
- `docs/API.md`

---

### #50 - Screenshots and demo video in README
**Status:** OPEN
**Created:** 2025-10-21
**Labels:** documentation
**Priority:** LOW
**Estimate:** 2 hours

**Issue:**
README has no visual preview. Potential users can't see what the UI looks like.

**Solution:**
Add visuals to README:
- Screenshots of main pages
- Demo GIF or video
- Feature highlights with images
- Before/after comparisons
- Store in `docs/images/`

**Files to Modify:**
- `README.md`

---

## 📊 Issue Summary by Priority

| Priority | Count | Total Estimate |
|----------|-------|----------------|
| 🔴 CRITICAL | 1 | TBD |
| 🟠 HIGH | 4 | 10 hours |
| 🟡 MEDIUM | 9 | 39 hours |
| 🔵 LOW | 6 | 55 hours |
| **Total** | **20** | **104+ hours** |

---

## 🎯 Recommended Next Actions

Based on priority and impact:

1. **Fix #56 (Settings page bug)** - CRITICAL bug blocking Settings functionality
2. **Complete #27 (Auto-refresh detail page)** - 2 hours, high UX impact
3. **Complete #36 (Disabled button tooltips)** - 2 hours, identified from screenshots
4. **Complete #28 (Actionable error messages)** - 4 hours, improves user experience
5. **Complete #29 (Network error differentiation)** - 2 hours, better troubleshooting

**Total for Quick Wins:** ~10-12 hours to complete top UX improvements

---

## 📝 Notes

- All issues created on 2025-10-21
- Many align with items in `IMPROVEMENTS.md`
- Several identified from user screenshots (cluster page, transformations)
- Focus areas: UX improvements, error handling, documentation
- Large backlog of nice-to-have features for future roadmap
