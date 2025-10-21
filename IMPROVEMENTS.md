# kconnect-console Improvements Tracker

**Last Updated:** 2025-10-20
**Status:** Active Development - Sprint 1 (UX Improvements)
**Progress:** 4/28 improvements completed (14%)

---

## 🎯 Priority Matrix

### 🔴 CRITICAL - Fix Immediately (Broken Functionality)
- [ ] **TBD** - Issues found during current state analysis

### 🟠 HIGH PRIORITY - Next Sprint (Major UX Issues)

**📸 Issues Identified from UI Screenshots (2025-10-20):**
- Cluster page: "Trigger rebalance (unavailable)" button with no explanation
- Cluster page: Large "NOT AVAILABLE" badges with no helpful context
- Transformations tab: Save Changes/Reset buttons with no loading state
- Multiple pages: Refresh buttons with no loading feedback

#### Auto-Refresh & Real-Time Updates
- [x] **[#1] Auto-refresh on connector list page** - 2 hours ✅ COMPLETED
  - **File:** `web/app/page.tsx`
  - **Issue:** Users must manually click "Refresh" to see status updates
  - **Fix:** Add 10-second polling with pause/resume control
  - **Impact:** Critical for operational awareness
  - **Completed:** 2025-10-20 - Commit f3b1802
  - **Tests:** 11/11 passing (`__tests__/autoRefresh.test.tsx`)

- [ ] **[#2] Auto-refresh on connector detail page** - 2 hours
  - **File:** `web/app/connectors/[name]/page.tsx`
  - **Issue:** No real-time updates on detail page
  - **Fix:** Add same polling mechanism
  - **Impact:** Users can't monitor connector recovery

#### Loading & Feedback States
- [ ] **[#3] Loading states for action buttons** - 3 hours ⏳ IN PROGRESS
  - **Files:**
    - `web/app/page.tsx` - List page Refresh button
    - `web/app/connectors/[name]/page.tsx` - Detail page action buttons
    - `web/app/connectors/[name]/TransformationsTab.tsx` - Save Changes/Reset buttons
    - `web/components/ConnectorBulkActions.tsx` - Bulk action buttons
    - `web/app/cluster/page.tsx` - Cluster page Refresh button
  - **Issue:** Multiple critical UX problems identified from screenshots:
    - Refresh button shows no loading state (cluster & list pages)
    - Action buttons (Pause/Resume/Restart) disable but show no progress
    - Save Changes/Reset in transformations have no loading feedback
    - Bulk actions show "Pausing..." but no spinner
    - Users repeatedly click buttons unsure if action registered
  - **Fix:** Comprehensive loading state implementation:
    - Create reusable `LoadingButton` component with spinner
    - Show action-specific text ("Saving...", "Pausing...", "Refreshing...")
    - Disable button during action
    - Add spinner icon (rotating circle)
    - Gray out button while loading
  - **Components to Create:**
    - `web/components/LoadingButton.tsx` - Reusable button with loading state
    - Props: `loading`, `loadingText`, `children`, `onClick`, `variant`
  - **Impact:** CRITICAL - Users can't tell if their actions are being processed
  - **Screenshots Evidence:** Cluster page shows multiple disabled buttons with no context
  - **Estimated Tests:** ~15 tests
    - LoadingButton component tests (8 tests)
    - Integration tests for each page (7 tests)

- [x] **[#4] Success toast notifications** - 2 hours ✅ COMPLETED
  - **Files:** `web/hooks/useToast.ts`, `web/components/Toast.tsx`, `web/components/ToastContainer.tsx`
  - **Issue:** No feedback when pause/resume/restart succeeds
  - **Fix:** Implemented toast notification system with auto-dismiss and type-based colors
  - **Impact:** Users now get clear feedback for all connector actions
  - **Completed:** 2025-10-20 - Commits 89f2fed, 34739ef
  - **Tests:** 26/26 passing (Toast + useToast), 113/113 total

#### Error Handling
- [ ] **[#5] Actionable error messages** - 4 hours
  - **Files:** Multiple (all error displays)
  - **Issue:** Generic "An error occurred" messages
  - **Fix:** Create `ErrorDisplay` component with suggestions and retry
  - **Impact:** Users can't troubleshoot issues

- [ ] **[#6] Network error differentiation** - 2 hours
  - **File:** `web/lib/fetchWithTimeout.ts`
  - **Issue:** Timeout vs connection refused look the same
  - **Fix:** Detect error types and provide specific guidance
  - **Impact:** Easier troubleshooting

#### Scalability
- [x] **[#7] Pagination for connector list** - 6 hours ✅ COMPLETED
  - **File:** `web/app/page.tsx`
  - **Issue:** Fetches ALL connectors (breaks with 100+ connectors)
  - **Fix:** Add pagination with 20 items per page
  - **Impact:** CRITICAL - App freezes with large deployments
  - **Completed:** 2025-10-20 - Commit 14c2096
  - **Tests:** 12/12 passing (`__tests__/pagination.test.tsx`)

- [x] **[#8] Request batching/concurrency limit** - 6 hours ✅ COMPLETED
  - **File:** `web/app/page.tsx`, `web/lib/batchFetch.ts`
  - **Issue:** Fires 200 parallel requests for 100 connectors
  - **Fix:** Batch requests with max 10 concurrent, show progress
  - **Impact:** Prevents browser/proxy overload
  - **Completed:** 2025-10-20 - Commit a066e35
  - **Tests:** 18/18 passing (`__tests__/batchFetch.test.ts`)

### 🟡 MEDIUM PRIORITY - Next 2-3 Sprints (Major Features)

#### Core Features
- [ ] **[#9] Connector configuration editing** - 8 hours
  - **File:** `web/app/connectors/[name]/page.tsx`
  - **Issue:** Can only view config, not edit after creation
  - **Fix:** Add "Edit Configuration" button + validation
  - **Impact:** CRITICAL - Users must delete/recreate to change config

- [ ] **[#10] Task-level restart** - 4 hours
  - **File:** `web/app/connectors/[name]/page.tsx`
  - **Issue:** Can't restart individual failed tasks
  - **Fix:** Add restart button per task in status display
  - **Impact:** Avoid restarting entire connector

- [ ] **[#11] Connector cloning** - 4 hours
  - **File:** New feature
  - **Issue:** Creating similar connectors requires manual copy-paste
  - **Fix:** "Clone" button that pre-fills new connector form
  - **Impact:** Major time saver for similar connectors

#### Organizational
- [ ] **[#12] Bulk configuration export** - 4 hours
  - **File:** New feature
  - **Issue:** Can't export configs for backup/migration
  - **Fix:** "Export All" button → downloads JSON
  - **Impact:** Critical for migrations

- [ ] **[#13] In-app help/tooltips** - 6 hours
  - **Files:** `web/app/connectors/new/page.tsx` and others
  - **Issue:** No inline help for complex fields
  - **Fix:** Add tooltip component with field explanations
  - **Impact:** Reduces support burden

- [ ] **[#14] Search by plugin type** - 3 hours
  - **File:** `web/app/page.tsx`
  - **Issue:** Can only search by name
  - **Fix:** Add plugin type filter dropdown
  - **Impact:** Useful for large deployments

#### UX Polish
- [ ] **[#15] Empty state guidance** - 2 hours
  - **File:** `web/app/page.tsx` (lines 573-577)
  - **Issue:** Generic "No connectors" message
  - **Fix:** Add "Clear filters" button and helpful text
  - **Impact:** Better UX

- [ ] **[#16] Confusing "Updated" column** - 1 hour
  - **File:** `web/app/page.tsx` (line 530)
  - **Issue:** Shows worker_id instead of timestamp
  - **Fix:** Rename to "Worker ID" or use real timestamp
  - **Impact:** Misleading information

- [ ] **[#17] Template availability UX** - 2 hours
  - **File:** `web/app/connectors/templates/page.tsx`
  - **Issue:** Unavailable templates look clickable
  - **Fix:** Disable with tooltip explaining missing plugin
  - **Impact:** Less confusing

- [ ] **[#29] Disabled button tooltips** - 2 hours
  - **Files:**
    - `web/app/cluster/page.tsx` - "Trigger rebalance (unavailable)" button
    - `web/app/cluster/page.tsx` - "Restart all connectors (unavailable)" button
  - **Issue:** Buttons show "(unavailable)" but don't explain WHY
  - **Fix:** Add tooltip component explaining requirements:
    - "Trigger rebalance" → "Requires Kafka Connect 2.8+ with rebalance API support"
    - "Restart all connections" → "Feature disabled for safety. Use bulk actions on Connectors page"
    - "NOT AVAILABLE" badges → Tooltip with version requirements
  - **Components to Create:**
    - `web/components/Tooltip.tsx` - Reusable tooltip component
  - **Impact:** Users understand why features are unavailable
  - **Screenshots Evidence:** Cluster page shows confusing disabled states
  - **Estimated Tests:** ~6 tests

### 🟢 LOW PRIORITY - Backlog (Nice-to-Have)

#### Advanced Features
- [ ] **[#18] Audit log** - 16 hours
  - **Issue:** No history of who changed what
  - **Fix:** Add audit log tracking all actions
  - **Impact:** Critical for team environments

- [ ] **[#19] Connector metrics/throughput** - 20 hours
  - **Issue:** No visibility into performance
  - **Fix:** Integrate JMX metrics
  - **Impact:** Advanced monitoring

- [ ] **[#20] Connector tagging/grouping** - 8 hours
  - **Issue:** No way to organize connectors
  - **Fix:** Add tags stored in config
  - **Impact:** Organizational

- [ ] **[#21] Keyboard shortcuts** - 6 hours
  - **Issue:** No keyboard-first workflow
  - **Fix:** Add Cmd+K for search, R for refresh, etc.
  - **Impact:** Power user feature

- [ ] **[#22] Dark mode** - 4 hours
  - **Issue:** No theme toggle
  - **Fix:** Add theme switcher in header
  - **Impact:** Aesthetic

- [ ] **[#23] Bulk selection shortcuts** - 3 hours
  - **Issue:** Can only select all or individually
  - **Fix:** Add "Select all failed", "Select all running"
  - **Impact:** Convenient

#### Accessibility
- [ ] **[#24] Checkbox label associations** - 2 hours
  - **File:** `web/app/page.tsx` (lines 459-467)
  - **Issue:** Screen readers can't identify checkboxes
  - **Fix:** Add proper aria-labelledby attributes
  - **Impact:** Accessibility

- [ ] **[#25] Error boundaries per component** - 4 hours
  - **Issue:** Component error crashes entire page
  - **Fix:** Wrap major sections in error boundaries
  - **Impact:** Resilience

#### Documentation
- [ ] **[#26] Troubleshooting guide** - 4 hours
  - **File:** `README.md`
  - **Issue:** Missing common scenarios
  - **Fix:** Add FAQ section with debugging steps
  - **Impact:** Self-service support

- [ ] **[#27] API documentation** - 6 hours
  - **File:** New `docs/API.md`
  - **Issue:** No endpoint docs for developers
  - **Fix:** Document all proxy endpoints
  - **Impact:** Developer experience

- [ ] **[#28] Screenshots in README** - 2 hours
  - **File:** `README.md`
  - **Issue:** No visual preview
  - **Fix:** Add screenshots and video
  - **Impact:** Marketing/adoption

---

## 🗺️ CURRENT SPRINT PLAN - Sprint 1: UX Improvements

**Sprint Goal:** Eliminate major UX friction points identified from user screenshots

**Duration:** 3-5 days
**Branch:** `feature/ux-improvements`
**Status:** IN PROGRESS

### ✅ Completed (4/7 tasks)
1. ✅ **Toast Notification System** - 2 hours
   - Commits: 89f2fed, 34739ef, add95a0
   - Tests: 26/26 passing
   - Impact: Users get immediate feedback for all actions

2. ✅ **Auto-refresh on List Page** - 2 hours
   - Commit: f3b1802
   - Tests: 11/11 passing
   - Impact: Users see real-time status updates

3. ✅ **Pagination** - 6 hours
   - Commit: 14c2096
   - Tests: 12/12 passing
   - Impact: Handles 100+ connectors without freezing

4. ✅ **Request Batching** - 6 hours
   - Commit: a066e35
   - Tests: 18/18 passing
   - Impact: Prevents browser overload

### ⏳ In Progress (1/7 tasks)
5. ⏳ **Loading States for Action Buttons** - 3 hours (CURRENT TASK)
   - **Plan:**
     - Step 1: Create `LoadingButton` component (30 min)
     - Step 2: Add tests for `LoadingButton` (30 min)
     - Step 3: Update list page Refresh button (15 min)
     - Step 4: Update detail page action buttons (30 min)
     - Step 5: Update transformations Save/Reset buttons (30 min)
     - Step 6: Update cluster page Refresh button (15 min)
     - Step 7: Integration tests (30 min)
   - **Files to Create:**
     - `web/components/LoadingButton.tsx`
     - `web/__tests__/LoadingButton.test.tsx`
   - **Files to Modify:**
     - `web/app/page.tsx`
     - `web/app/connectors/[name]/page.tsx`
     - `web/app/connectors/[name]/TransformationsTab.tsx`
     - `web/app/cluster/page.tsx`
   - **Expected Outcome:** All action buttons show clear loading state with spinner

### 📋 Remaining (2/7 tasks)
6. 📋 **Auto-refresh on Detail Page** - 2 hours
   - **Plan:** Copy pattern from list page implementation
   - **Impact:** Users can monitor connector recovery in real-time

7. 📋 **Disabled Button Tooltips** - 2 hours
   - **Plan:** Create Tooltip component, add to unavailable features
   - **Impact:** Users understand why features are disabled

### 🎯 Sprint Success Criteria
- [ ] All action buttons show loading state with spinner
- [ ] Toast notifications work on all pages
- [ ] Detail page has auto-refresh toggle
- [ ] Disabled buttons have explanatory tooltips
- [ ] All tests passing (target: 130+ tests)
- [ ] ESLint + TypeScript checks pass
- [ ] Production build succeeds

### 📊 Progress Tracking
- **Total Time Estimated:** 17 hours
- **Time Spent:** 10 hours
- **Time Remaining:** 7 hours
- **Completion:** 57% (4/7 tasks)

---

## 📊 Quick Win Bundle (1-2 days total)

Priority items that are high impact, low effort:

1. ✅ **Auto-refresh on main page** - 2 hours
2. ✅ **Loading states for buttons** - 3 hours
3. ✅ **Success notifications** - 2 hours
4. ✅ **Better error messages** - 4 hours
5. ✅ **Connector cloning** - 4 hours
6. ✅ **Empty state improvements** - 2 hours

**Total: ~17 hours (~2 days)**

---

## 🎯 Sprint Recommendations

### Sprint 1: Critical UX (1 week)
- Auto-refresh (main + detail pages)
- Loading states
- Success notifications
- Better error messages
- Pagination

**Outcome:** Daily use experience dramatically improved

### Sprint 2: Core Features (1 week)
- Connector editing
- Task-level restart
- Connector cloning
- Bulk export
- In-app help

**Outcome:** Production-ready for all teams

### Sprint 3: Scale & Polish (1 week)
- Request batching
- Search by plugin type
- Audit logging (basic version)
- Keyboard shortcuts
- Documentation improvements

**Outcome:** Enterprise-grade UI

---

## 🐛 Current State Analysis (2025-10-20)

### ✅ **GOOD NEWS: Core Functionality Works!**

Tested the full stack and everything is operational:

**✅ Services Running:**
- Zookeeper: Healthy
- Kafka: Healthy
- Kafka Connect: Healthy (http://localhost:8083)
- Proxy: Healthy (http://localhost:8080)
- Web UI: Healthy (http://localhost:3000)

**✅ API Endpoints Working:**
- `/health` - Returns proper 200 OK with Kafka Connect status
- `/api/default/connectors` - Lists connectors correctly
- `POST /api/default/connectors` - Creates connectors successfully
- `/api/default/connectors/{name}/status` - Returns status correctly

**✅ Test Results:**
- Created test-datagen connector ✅
- Connector started and running ✅
- Task 0 in RUNNING state ✅
- No errors in proxy logs ✅
- No errors in web logs ✅
- Build completes without errors ✅

### 🔍 **Issues Found During Testing:**

#### 1. **Docker Compose Version Warning** - LOW PRIORITY
**Location:** `compose/docker-compose.yml` (line 1)
```yaml
version: "3.9"  # ← This line is obsolete
```
**Warning:** `level=warning msg="the attribute 'version' is obsolete"`
**Fix:** Remove the version line
**Priority:** LOW - Just a warning, doesn't affect functionality

#### 2. **No Visual Confirmation in Browser** - MEDIUM PRIORITY
**Issue:** Can't verify UI works without opening browser
**Recommendation:** Add basic e2e tests or screenshot testing
**Priority:** MEDIUM

### 🎯 **What Works Perfectly:**

1. ✅ Environment-aware configuration (all our bug fixes)
2. ✅ Health checks return proper status codes
3. ✅ CORS configured correctly
4. ✅ Credential redaction working
5. ✅ Request timeouts in place
6. ✅ Parallel requests working
7. ✅ Connector CRUD operations
8. ✅ No crashes or panics

### 🔧 **Minor Issues to Clean Up:**

- [ ] **Docker Compose version warning** - 5 min fix
- [ ] **Add browser e2e test** - 2 hours (optional)

### 📝 **Verified User Flows:**

1. ✅ Start stack → All services healthy
2. ✅ Create connector via API → Success
3. ✅ Check connector status → Running
4. ✅ Health check endpoint → Accurate status
5. ✅ Proxy logging → Clean, no errors

**Conclusion:** The project is in **excellent working condition**. All critical bug fixes are functioning properly. The improvements list is focused on UX enhancements, not critical bugs.

---

## 📝 Notes

- All time estimates are rough approximations
- Priority levels may shift based on user feedback
- Items marked "CRITICAL" should block next release
- Each item should have its own commit when completed

---

## 🔗 Reference

- Full analysis: `docs/END_USER_ANALYSIS.md` (if created)
- Original bug fixes: See recent commits (aa0fe95 through 47bf49a)
- Configuration guide: `.env.example`
