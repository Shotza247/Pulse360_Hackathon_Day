# eWay 360° Performance Review — Epics, User Stories & Test Cases

> **Based on:** `1. Challenge.md`, `2. Use Case Specification.md`, `3. Architecture Requirements.md`, `4. Tooling Setup.md`, and the Ovations employee export (57 employees across 8+ departments).

---

## 🗺️ System Context

| Actor | Role |
|-------|------|
| **HR Administrator** | Manages employees & cycles; views all results |
| **Line Manager** | Approves nominations; views team results (anonymised) |
| **Employee** | Nominates, reviews peers, views own results |
| **System (Auto)** | Calculates averages and aggregations |

**Tech Stack:** Next.js + PostgreSQL + Session/JWT  
**Run target:** Locally on a laptop (demo-able)

---

## 📦 EPICS

| Epic ID | Epic Name | MVP | Description |
|---------|-----------|-----|-------------|
| **EP-01** | Authentication & User Management | MVP 1 | Login, RBAC, employee CRUD, manager assignment |
| **EP-02** | Review Cycle Management | MVP 1 | Create, progress, and close review cycles |
| **EP-03** | Nomination Management | MVP 1 | Peer nominations, manager auto-inclusion, limits |
| **EP-04** | Nomination Approval | MVP 1 | Manager approval/rejection of nominations |
| **EP-05** | Employee Review & Rating | MVP 1 | Rating submission on all eWay criteria |
| **EP-06** | Score Calculation & Results | MVP 1 | Aggregations, anonymised comments, result views |
| **EP-07** | Dashboards & Navigation | MVP 1 | Role-aware home pages and pending action indicators |
| **EP-08** | eWay Criteria Management | MVP 2 | Admin CRUD of criteria + default seeding |
| **EP-09** | Employee Data Import | MVP 2 | Bulk XLSX/CSV import from HR system |
| **EP-10** | AI-Assisted Features | MVP 2 | Comment suggestions, theme summaries (HITL) |
| **EP-11** | Reporting & Analytics | MVP 2 | PDF reports, heatmaps, historical comparison |
| **EP-12** | Notifications & Audit | MVP 2 | Email/in-app notifications, audit trail |
| **EP-13** | Custom / Bonus Features | Custom | Self-assessment, mobile responsive, calibration view |

---

## 📖 USER STORIES

### EP-01 — Authentication & User Management

---

#### US-01-01 · Employee Login

> **As an** Ovations employee,
> **I want to** log in using my Office 365 email and password,
> **so that** I can securely access the eWay 360° review application.

**Acceptance Criteria:**
- Valid credentials grant access and establish a JWT session
- Invalid credentials display an error message without revealing which field is wrong
- Passwords are **never stored** in the database (SSO / token only)
- Session persists until explicit logout or token expiry

**Story Points:** 5 | **Label:** `mvp1` | **Priority:** Critical

---

#### US-01-02 · Role-Based Access Control

> **As an** application user,
> **I want to** see only the screens and actions relevant to my role (Admin / Line Manager / Employee),
> **so that** I cannot accidentally access or modify data outside my permissions.

**Acceptance Criteria:**
- HR Admin can access cycle management, employee management, all results
- Line Manager can access team nominations, team results; cannot see individual reviewer identities
- Employee can access own nominations, own reviews, own results only
- Direct URL access to unauthorised pages returns a 403 page

**Story Points:** 5 | **Label:** `mvp1` | **Priority:** Critical

---

#### US-01-03 · HR Admin Manages Employees

> **As an** HR Administrator,
> **I want to** add, edit, and deactivate employee records,
> **so that** the system reflects the current Ovations headcount at all times.

**Acceptance Criteria:**
- Can create an employee with: name, email, department, job title, manager, role
- Can edit any employee field
- Deactivating an employee prevents them from logging in and excludes them from new cycles
- Deactivated employees' historical data is preserved

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** High

---

#### US-01-04 · Assign Line Manager

> **As an** HR Administrator,
> **I want to** assign exactly one Line Manager to each employee,
> **so that** the manager is automatically included as a mandatory reviewer in review cycles.

**Acceptance Criteria:**
- Each employee record has exactly one manager field
- Manager assignment visible in the employee profile
- Changing a manager takes effect on the next review cycle (does not affect in-progress cycles)

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** High

---

#### US-01-05 · Initial Admin Bootstrap

> **As an** application operator,
> **I want to** configure at least one HR Admin on first startup,
> **so that** there is always an account that can create employees and manage the system.

**Acceptance Criteria:**
- On fresh DB, seed script or startup wizard creates a default HR Admin account
- Cannot delete the last HR Admin account
- First-login prompt to change the default password

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** High

---

### EP-02 — Review Cycle Management

---

#### US-02-01 · Create Review Cycle

> **As an** HR Administrator,
> **I want to** create a new review cycle with a name, start/end dates, and selected eWay criteria,
> **so that** a structured review period is established for all employees.

**Acceptance Criteria:**
- Fields: cycle name (e.g. "H1 2026"), start date, end date, eWay criteria selection
- Cycle is saved in **DRAFT** status
- Cannot create a new cycle if one is already active (not CLOSED)

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** High

---

#### US-02-02 · Advance Cycle Through Phases

> **As an** HR Administrator,
> **I want to** progress the cycle through its lifecycle phases,
> **so that** employees are guided through nomination, review, and results in a controlled sequence.

**Acceptance Criteria:**
- Phase transitions: DRAFT → NOMINATE → APPROVE → REVIEW → CALCULATION → CONSULTATION → ACCEPT → CLOSED
- Each transition requires admin confirmation
- Cycle dashboard shows current phase and completion statistics

**Story Points:** 5 | **Label:** `mvp1` | **Priority:** High

---

#### US-02-03 · Cycle Progress Dashboard

> **As an** HR Administrator,
> **I want to** see a dashboard with progress statistics for the active cycle,
> **so that** I can monitor participation and take action where needed.

**Acceptance Criteria:**
- Shows: total employees in cycle, % nominations submitted, % reviews completed, current phase
- Refreshes in real time or on page reload
- Allows drill-down to see which employees have not yet submitted

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** Medium

---

### EP-03 — Nomination Management

---

#### US-03-01 · Nominate Inbound Reviewers

> **As an** Employee,
> **I want to** select peers from the employee directory who will review me,
> **so that** I receive 360° feedback from colleagues I work with.

**Acceptance Criteria:**
- Employee can search and select peers from the full active employee list
- Selected peers are added to the inbound reviewer list
- Duplicate nominations rejected
- My own manager is pre-selected and greyed out (cannot be removed)

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** High

---

#### US-03-02 · Nominate Outbound Reviews

> **As an** Employee,
> **I want to** nominate colleagues I want to review,
> **so that** I can provide feedback to peers I have worked with during the cycle.

**Acceptance Criteria:**
- Employee can select colleagues to review (outbound)
- Listed separately from inbound nominees
- Min/max limits enforced on submission

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** High

---

#### US-03-03 · Manager Auto-Included as Mandatory Reviewer

> **As an** Employee,
> **I want** my Line Manager to be automatically included and locked as a reviewer,
> **so that** there is always a mandatory managerial perspective in my review.

**Acceptance Criteria:**
- Manager appears pre-selected in the reviewer list on page load
- Remove/uncheck action is disabled for the manager entry
- Nomination cannot be submitted without the manager in the list

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** Critical

---

#### US-03-04 · Enforce Min/Max Nomination Limits

> **As an** HR Administrator,
> **I want** the system to enforce configurable minimum (e.g. 3) and maximum (e.g. 8) reviewer limits,
> **so that** every employee receives a statistically meaningful number of reviews.

**Acceptance Criteria:**
- Submit button disabled if reviewer count < minimum
- Cannot add more reviewers beyond the maximum
- Min and max values configurable per cycle by Admin

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** High

---

#### US-03-05 · Save Nomination as Draft

> **As an** Employee,
> **I want to** save my nominations as a draft and return later to finalise them,
> **so that** I am not forced to complete the nomination in a single session.

**Acceptance Criteria:**
- "Save Draft" button saves current state without validating min/max
- Draft state is visible on the employee dashboard
- Employee can resume the draft at any time before the nomination window closes

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** Medium

---

#### US-03-06 · View Nomination Summary

> **As an** Employee,
> **I want to** see a summary of my nominations (who reviews me, who I review, status),
> **so that** I have full visibility of my participation in the current cycle.

**Acceptance Criteria:**
- Shows two lists: "Reviewing me" and "I am reviewing"
- Shows status per nomination: Pending, Approved, Rejected
- Manager entry clearly labelled as "Mandatory"

**Story Points:** 1 | **Label:** `mvp1` | **Priority:** Medium

---

### EP-04 — Nomination Approval

---

#### US-04-01 · Manager Reviews Nominations for Direct Reports

> **As a** Line Manager,
> **I want to** see the full list of peer nominations submitted by each of my direct reports,
> **so that** I can validate that the chosen reviewers are appropriate.

**Acceptance Criteria:**
- Manager sees one card/section per direct report
- Each card lists all nominated reviewers with Approve / Reject action per entry
- Shows current approval status

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** High

---

#### US-04-02 · Approve or Reject Individual Nominations

> **As a** Line Manager,
> **I want to** approve or reject individual nominees,
> **so that** only appropriate reviewers participate in the feedback process.

**Acceptance Criteria:**
- Rejected nominations are removed from the reviewer list
- Employee is notified of rejection (in-app or email)
- After rejection, system re-validates minimum threshold; if breached, employee can add more nominees

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** High

---

#### US-04-03 · HR Admin Override Approvals

> **As an** HR Administrator,
> **I want to** approve or modify any nomination regardless of manager decision,
> **so that** I can intervene in edge cases or disputes.

**Acceptance Criteria:**
- Admin can approve a rejected nomination
- Admin can reject an approved nomination
- All overrides are logged with timestamp and reason

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** Medium

---

### EP-05 — Employee Review & Rating

---

#### US-05-01 · View Pending Reviews

> **As a** Reviewer (Employee or Manager),
> **I want to** see a list of all people I need to review,
> **so that** I know exactly how many reviews I have outstanding.

**Acceptance Criteria:**
- Dashboard shows name, department, and completion status (Not Started / Draft / Submitted) per pending review
- Completed reviews are shown separately or marked clearly
- Badge on navigation shows count of outstanding reviews

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** High

---

#### US-05-02 · Rate on All eWay Criteria (1–5)

> **As a** Reviewer,
> **I want to** rate an employee on every active eWay criterion using a 1–5 scale,
> **so that** structured quantitative feedback is captured for each competency.

**Acceptance Criteria:**
- All 5 elements displayed (MASTERFUL, EXCELLENCE, EXECUTION, COMMITMENT, CONTRIBUTION) with all 5 sub-questions each
- Each sub-question requires a 1–5 rating selection
- Rating scale labels shown: 1=Needs Significant Improvement … 5=Exceptional
- Cannot submit a review with any criterion left unrated

**Story Points:** 5 | **Label:** `mvp1` | **Priority:** Critical

---

#### US-05-03 · Provide "What They Do Well" Comment

> **As a** Reviewer,
> **I want to** write a free-text comment about what the employee does well,
> **so that** positive reinforcement feedback is captured qualitatively.

**Acceptance Criteria:**
- Free-text area, minimum 20 characters enforced before submission
- Character count displayed as user types
- Saved alongside the ratings

**Story Points:** 1 | **Label:** `mvp1` | **Priority:** High

---

#### US-05-04 · Provide "What They Need to Improve" Comment

> **As a** Reviewer,
> **I want to** write a free-text comment about areas where the employee should improve,
> **so that** constructive development feedback is captured.

**Acceptance Criteria:**
- Free-text area, minimum 20 characters enforced before submission
- Character count displayed as user types
- Saved alongside the ratings

**Story Points:** 1 | **Label:** `mvp1` | **Priority:** High

---

#### US-05-05 · Provide Additional Questions Responses

> **As a** Reviewer,
> **I want to** answer the three additional questions (attention area, doing well, team preference),
> **so that** supplementary qualitative data is captured.

**Acceptance Criteria:**
- Question 1: multiline text ("What should this person pay attention to?")
- Question 2: multiline text ("What is this person doing well?")
- Question 3: Yes/No toggle ("Would you want this person on your team?")
- All three fields are required before submission

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** High

---

#### US-05-06 · Save Review as Draft

> **As a** Reviewer,
> **I want to** save my review as a draft and return to complete it later,
> **so that** I can take my time providing thoughtful feedback.

**Acceptance Criteria:**
- "Save Draft" available at any point without triggering validation
- Draft is excluded from score calculations until submitted
- Reviewer can resume the draft from their dashboard

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** Medium

---

#### US-05-07 · Submit and Lock Review

> **As a** Reviewer,
> **I want** my review to be locked after submission,
> **so that** the integrity of submitted feedback is preserved.

**Acceptance Criteria:**
- Submission requires all criteria rated and both comments filled (min 20 chars)
- Confirmation dialog shown before final submission
- After submission, all fields are read-only
- Submitted status reflected on the dashboard

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** High

---

### EP-06 — Score Calculation & Results

---

#### US-06-01 · System Calculates Per-Criterion Averages

> **As an** HR Administrator,
> **I want** the system to automatically calculate the average score per eWay criterion per employee,
> **so that** results are consistent and free from manual calculation errors.

**Acceptance Criteria:**
- Average calculated from all submitted reviews only (drafts excluded)
- Per sub-question scores averaged first, then element average calculated
- Displayed to exactly 2 decimal places
- Triggered automatically when cycle moves to CALCULATION phase

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** Critical

---

#### US-06-02 · System Calculates Overall Average Score

> **As an** HR Administrator,
> **I want** the system to produce a single overall average score per employee,
> **so that** a high-level performance indicator is available for each person.

**Acceptance Criteria:**
- Overall = average of all 5 eWay element averages
- Displayed to 2 decimal places
- Stored in `ReviewResult` table for historical reference

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** High

---

#### US-06-03 · Employee Views Own Results (Anonymised)

> **As an** Employee,
> **I want to** view my aggregated review results after the cycle reaches the ACCEPT phase,
> **so that** I understand how my peers and manager rated me across the eWay criteria.

**Acceptance Criteria:**
- Shows per-element averages and overall score
- Shows "Based on X reviews" count without naming reviewers
- All comments shown without reviewer attribution
- Not accessible before ACCEPT phase

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** High

---

#### US-06-04 · Manager Views Team Results

> **As a** Line Manager,
> **I want to** view the aggregated results for each of my direct reports,
> **so that** I can have informed performance conversations with my team.

**Acceptance Criteria:**
- Manager can see results for all direct reports once CONSULTATION phase is reached
- Reviewer identities are hidden (comments anonymised)
- Results shown per criterion and as an overall score

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** High

---

#### US-06-05 · HR Admin Views All Results

> **As an** HR Administrator,
> **I want to** view, filter, and sort all employee results,
> **so that** I have a complete organisational performance picture.

**Acceptance Criteria:**
- Filter by department
- Sort by overall score (ascending/descending)
- Drill into any employee's detailed result page
- Export to Excel available (bonus)

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** High

---

### EP-07 — Dashboards & Navigation

---

#### US-07-01 · Role-Appropriate Home Dashboard

> **As any** user,
> **I want** my home page to show content relevant to my role,
> **so that** I immediately see what actions I need to take.

**Acceptance Criteria:**
- **HR Admin:** Active cycle name, phase, % nominations in, % reviews done, quick-action buttons
- **Line Manager:** Team nomination approval queue, team review completion %, link to team results
- **Employee:** My pending nominations, my outstanding reviews, my results status

**Story Points:** 3 | **Label:** `mvp1` | **Priority:** High

---

#### US-07-02 · Role-Filtered Navigation Menu

> **As any** user,
> **I want** the navigation menu to show only links I am authorised to use,
> **so that** I am not confused by features I cannot access.

**Acceptance Criteria:**
- Admin-only links hidden for Manager and Employee roles
- No broken/dead navigation links for any role
- Active section highlighted in the menu

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** Medium

---

#### US-07-03 · Pending Actions Badge

> **As any** user,
> **I want** to see a badge count on navigation items showing outstanding actions,
> **so that** I am reminded of things I need to complete.

**Acceptance Criteria:**
- Nominations to submit: badge shows count
- Reviews to complete: badge shows count
- Approvals pending (Manager): badge shows count
- Badges update on every page load

**Story Points:** 2 | **Label:** `mvp1` | **Priority:** Medium

---

### EP-08 — eWay Criteria Management (MVP 2)

---

#### US-08-01 · Admin Views eWay Criteria List

> **As an** HR Administrator,
> **I want to** view all eWay criteria with their active/inactive status,
> **so that** I can manage which competencies are used in upcoming cycles.

**Story Points:** 1 | **Label:** `mvp2`

---

#### US-08-02 · Admin Adds / Edits / Deactivates Criteria

> **As an** HR Administrator,
> **I want to** create new criteria, edit existing ones, and deactivate outdated ones,
> **so that** the performance framework can evolve without losing historical data.

**Acceptance Criteria:**
- Deactivated criteria excluded from new cycles; preserved in historical results
- Default 5 elements (MASTERFUL, EXCELLENCE, EXECUTION, COMMITMENT, CONTRIBUTION) seeded on install
- Edit changes reflected immediately in any cycle in DRAFT status

**Story Points:** 3 | **Label:** `mvp2`

---

### EP-09 — Employee Data Import (MVP 2)

---

#### US-09-01 · Bulk Import Employees from XLSX/CSV

> **As an** HR Administrator,
> **I want to** import employees from the HR system's XLSX export,
> **so that** I do not need to manually add all 57 Ovations employees one by one.

**Acceptance Criteria:**
- Accepts columns: Key, First Name, Last Name, Job Title, Email, Department, Manager, Job Grade
- Validates each row before import; shows preview with error highlighting
- Duplicate emails detected and flagged (update vs skip option)
- Manager name resolved to existing employee record; unresolved names flagged

**Story Points:** 5 | **Label:** `mvp2`

---

### EP-10 — AI-Assisted Features (MVP 2)

---

#### US-10-01 · AI Comment Suggestions (HITL)

> **As a** Reviewer,
> **I want** the system to suggest draft comments based on my ratings,
> **so that** I have a starting point for qualitative feedback, which I can then edit or discard.

**Acceptance Criteria:**
- After entering ratings, "Suggest Comments" button appears
- AI generates a suggested "doing well" and "needs improvement" comment
- Reviewer can: Accept, Edit, or Discard the suggestion
- Human edit or discard decision is logged as a HITL intervention

**Story Points:** 5 | **Label:** `mvp2`, `hitl`

---

#### US-10-02 · AI Feedback Theme Summary

> **As an** HR Administrator or Employee,
> **I want** the system to generate an AI-powered summary of themes from all my anonymised feedback,
> **so that** key patterns across multiple reviewers are surfaced quickly.

**Acceptance Criteria:**
- AI analyses all anonymised comments for an employee
- Outputs: top 3 strengths, top 3 improvement areas, overall sentiment
- Generated per-employee during or after CALCULATION phase
- Admin can regenerate; each generation logged with timestamp (HITL traceability)

**Story Points:** 5 | **Label:** `mvp2`, `hitl`

---

### EP-11 — Reporting & Analytics (MVP 2)

---

#### US-11-01 · PDF Performance Report

> **As a** Line Manager or HR Administrator,
> **I want to** download a PDF report for an employee,
> **so that** I have a portable, printable record for performance conversations.

**Acceptance Criteria:**
- PDF includes: employee name, cycle name, radar chart of criteria scores, overall score, anonymised comments
- Download triggered from the results page
- Filename format: `{EmployeeName}_{CycleName}_Review.pdf`

**Story Points:** 5 | **Label:** `mvp2`

---

#### US-11-02 · Historical Comparison (Trend)

> **As an** Employee or Manager,
> **I want to** compare my results across multiple cycles,
> **so that** I can track my performance trajectory over time.

**Acceptance Criteria:**
- Shows trend line per criterion across all completed cycles
- Requires at least 2 closed cycles to display
- Visible on the employee results page

**Story Points:** 3 | **Label:** `mvp2`

---

#### US-11-03 · Department Heatmap

> **As an** HR Administrator,
> **I want to** see a heatmap of average scores per eWay criterion per department,
> **so that** I can identify org-wide strengths and skill gaps.

**Acceptance Criteria:**
- Grid: rows = departments, columns = eWay criteria
- Colour scale: red (low) → amber → green (high)
- Hovering a cell shows the actual average score
- Visible on the HR Admin analytics page

**Story Points:** 3 | **Label:** `mvp2`

---

### EP-12 — Notifications & Audit (MVP 2)

---

#### US-12-01 · In-App / Email Notifications

> **As any** user,
> **I want to** receive notifications at key cycle milestones,
> **so that** I never miss a deadline.

**Notification triggers:**
- Nomination window opens → Employee
- Peer nomination received → Employee
- Reviews are due → Employee / Manager
- Results available → Employee

**Story Points:** 5 | **Label:** `mvp2`

---

#### US-12-02 · Audit Trail

> **As an** HR Administrator,
> **I want** all significant system actions to be logged with a timestamp and user,
> **so that** I have full traceability for compliance and dispute resolution.

**Logged events:** cycle created, nomination submitted, nomination approved/rejected, review submitted, score calculated, cycle phase changed, admin override.

**Story Points:** 3 | **Label:** `mvp2`

---

## ✅ TEST CASES

### TC-01 — Authentication

| TC ID | Test Case | Pre-condition | Steps | Expected Result | Pass/Fail |
|-------|-----------|---------------|-------|-----------------|-----------|
| TC-01-01 | Valid login | App running, user `charmaines@ovationsgroup.com` exists | Enter valid email + password → Click Login | User redirected to role dashboard; JWT session cookie set | |
| TC-01-02 | Invalid password | User exists | Enter correct email + wrong password → Click Login | Error: "Invalid credentials"; no session created | |
| TC-01-03 | Unknown email | — | Enter non-existent email → Click Login | Error: "Invalid credentials" (same message, no user enumeration) | |
| TC-01-04 | Role redirect — HR Admin | Admin account | Login as HR Admin | Redirected to Admin dashboard showing cycle management | |
| TC-01-05 | Role redirect — Line Manager | Manager account | Login as `EddieH@OvationsGroup.com` | Redirected to Manager dashboard showing team nominations | |
| TC-01-06 | Role redirect — Employee | Employee account | Login as `GerritV@OvationsGroup.com` | Redirected to Employee dashboard showing pending actions | |
| TC-01-07 | Unauthorised URL access | Logged in as Employee | Navigate directly to `/admin/employees` | 403 Forbidden page displayed | |
| TC-01-08 | Session persistence | Logged in | Close and reopen browser tab | User remains logged in (session persists) | |
| TC-01-09 | Logout | Logged in | Click Logout | Session cleared; redirected to login page; back-button does not restore session | |
| TC-01-10 | Password not in DB | Admin creates new user | Inspect database `employees` table after creating user | No `password` column with plaintext value present | |

---

### TC-02 — User Management

| TC ID | Test Case | Pre-condition | Steps | Expected Result | Pass/Fail |
|-------|-----------|---------------|-------|-----------------|-----------|
| TC-02-01 | Add new employee | Logged in as HR Admin | Navigate to Employees → Add New → Fill all fields → Save | New employee record appears in list; can log in | |
| TC-02-02 | Edit employee details | Employee exists | Edit job title and department → Save | Updated values reflected in employee list and profile | |
| TC-02-03 | Deactivate employee | Employee exists, no active cycle | Click Deactivate on `archiel@ovationsgroup.com` | Employee flagged inactive; cannot log in; excluded from new cycle | |
| TC-02-04 | Set manager relationship | Employee without manager | Assign `NICO DE NYSSCHEN` as manager for `archiel@ovationsgroup.com` | Manager field updated; Nico auto-included in Archie's reviewer list next cycle | |
| TC-02-05 | Duplicate email rejected | Employee exists | Try to add new employee with same email | Error: "Email already in use" | |
| TC-02-06 | Cannot delete last HR Admin | Only 1 admin | Attempt to deactivate the only HR Admin account | Error: "Cannot deactivate the only HR Administrator" | |

---

### TC-03 — Review Cycle Management

| TC ID | Test Case | Pre-condition | Steps | Expected Result | Pass/Fail |
|-------|-----------|---------------|-------|-----------------|-----------|
| TC-03-01 | Create cycle — happy path | No active cycle | Create cycle "H1 2026", set dates, select all criteria → Save | Cycle created in DRAFT status, visible on dashboard | |
| TC-03-02 | Prevent duplicate active cycle | One cycle is active | Attempt to create another cycle | Error: "A cycle is already in progress. Close it first." | |
| TC-03-03 | Advance to NOMINATE | Cycle in DRAFT | Click "Open Nominations" | Cycle status → NOMINATE; employees can now nominate | |
| TC-03-04 | Advance through all phases | Cycle in NOMINATE | Sequentially advance through all phases | Each status transition is logged; system performs CALCULATION automatically | |
| TC-03-05 | Dashboard completion stats | Cycle in REVIEW | 3 of 10 employees have submitted reviews | Dashboard shows "Reviews completed: 30%" | |
| TC-03-06 | Close cycle makes results read-only | Cycle in ACCEPT | Advance to CLOSED | All results become read-only; no further edits possible | |

---

### TC-04 — Nominations

| TC ID | Test Case | Pre-condition | Steps | Expected Result | Pass/Fail |
|-------|-----------|---------------|-------|-----------------|-----------|
| TC-04-01 | Manager pre-selected and locked | Employee in NOMINATE phase | Open Nomination page as Gerrit Van Milligen | `HANNES VAN DER WALT` (Gerrit's manager) is pre-selected and greyed out | |
| TC-04-02 | Add inbound reviewer | Nomination page open | Select `philipn@ovationsgroup.com` as inbound reviewer | Phillip added to "Reviews Me" list | |
| TC-04-03 | Minimum limit enforced | 2 reviewers selected (min=3) | Click Submit | Error: "Minimum 3 reviewers required. Add at least 1 more." | |
| TC-04-04 | Maximum limit enforced | 8 reviewers already selected (max=8) | Try to add a 9th reviewer | Add button disabled; tooltip: "Maximum 8 reviewers reached" | |
| TC-04-05 | Save draft | 2 reviewers selected | Click "Save Draft" | Nominations saved without validation error; dashboard shows DRAFT status | |
| TC-04-06 | Resume draft | Draft saved | Return to Nomination page | Previous selections pre-populated | |
| TC-04-07 | Submit nominations | Min satisfied, all required | Click Submit → Confirm | Status changes to SUBMITTED; nominees notified | |
| TC-04-08 | Nomination summary | Nominations submitted | Navigate to Nomination Summary | Shows inbound list, outbound list, status per nominee; manager marked "Mandatory" | |

---

### TC-05 — Nomination Approval

| TC ID | Test Case | Pre-condition | Steps | Expected Result | Pass/Fail |
|-------|-----------|---------------|-------|-----------------|-----------|
| TC-05-01 | Manager sees direct report nominations | Cycle in APPROVE | Login as `EddieH@OvationsGroup.com` | Sees nomination cards for: Andrew, Donald, Dudu, Hannes, Naseem | |
| TC-05-02 | Approve individual nominee | Nomination pending | Click Approve on a nominee | Nominee status → Approved; included in review phase | |
| TC-05-03 | Reject nominee | Nomination pending | Click Reject on a nominee | Nominee removed; employee notified; if below min, employee prompted to add more | |
| TC-05-04 | Admin override rejection | Nominee rejected by manager | Admin approves the rejected nominee | Nominee status → Approved; override logged | |
| TC-05-05 | Rejection drops below minimum | Employee had exactly 3, one rejected | Rejection processed | Employee receives notification to nominate an additional reviewer | |

---

### TC-06 — Employee Review & Rating

| TC ID | Test Case | Pre-condition | Steps | Expected Result | Pass/Fail |
|-------|-----------|---------------|-------|-----------------|-----------|
| TC-06-01 | View pending reviews list | Cycle in REVIEW | Login as reviewer | Dashboard shows list of people to review with Not Started / Draft / Submitted status | |
| TC-06-02 | All 25 questions displayed | Open a review | Navigate to review form | All 5 eWay elements with 5 sub-questions each are visible (25 total) | |
| TC-06-03 | Additional 3 questions displayed | Review form open | Scroll to bottom | ADDITIONAL QUESTIONS section: 2 text boxes + 1 Yes/No | |
| TC-06-04 | Rating scale validation | Attempt to submit | Leave one sub-question unrated → Submit | Error highlighting on unrated field; submission blocked | |
| TC-06-05 | Comment minimum length | Both comments < 20 chars | Click Submit | Error: "Comment must be at least 20 characters" on offending field | |
| TC-06-06 | Save draft review | Partial review | Click Save Draft | Draft saved; excluded from calculations; dashboard shows "Draft" | |
| TC-06-07 | Submit and lock review | All fields filled | Click Submit → Confirm | Review locked; all fields read-only; status → Submitted | |
| TC-06-08 | Cannot edit submitted review | Review submitted | Navigate to submitted review | All fields read-only; no Submit/Save buttons | |
| TC-06-09 | Rating scale labels visible | Review form open | Hover/view scale | Labels shown: 1=Needs Significant Improvement, 2=Needs Improvement, 3=Meets Expectations, 4=Exceeds Expectations, 5=Exceptional | |

---

### TC-07 — Score Calculation

| TC ID | Test Case | Pre-condition | Steps | Expected Result | Pass/Fail |
|-------|-----------|---------------|-------|-----------------|-----------|
| TC-07-01 | Per-criterion average accuracy | 3 reviewers submitted scores: Masterful Q1 = [3, 4, 5] | Advance to CALCULATION | Average for Masterful Q1 = 4.00 | |
| TC-07-02 | Element average — 2 decimal places | Masterful sub-scores: [3.00, 4.00, 5.00, 2.00, 4.00] | Post calculation | Masterful element average = 3.60 | |
| TC-07-03 | Overall average | 5 element averages: [3.60, 4.20, 3.80, 4.40, 3.00] | Post calculation | Overall average = 3.80 | |
| TC-07-04 | Draft reviews excluded | Reviewer has draft (not submitted) | Advance to CALCULATION | Draft reviewer's scores not included in averages | |
| TC-07-05 | Reviewer count shown, not names | Employee views results | Navigate to own results | "Based on 4 reviews" shown; no reviewer names | |
| TC-07-06 | Comments anonymised | Employee views results | Navigate to own results | "What they do well" comments listed without names; same for improvement comments | |
| TC-07-07 | Edge case — single reviewer | Only 1 reviewer submitted | Advance to CALCULATION | Score = that single reviewer's score; shown as "Based on 1 review" | |
| TC-07-08 | Edge case — boundary scores (min) | All reviewers score 1 on all criteria | Post calculation | All averages = 1.00; overall = 1.00 | |
| TC-07-09 | Edge case — boundary scores (max) | All reviewers score 5 on all criteria | Post calculation | All averages = 5.00; overall = 5.00 | |

---

### TC-08 — Results & Visibility

| TC ID | Test Case | Pre-condition | Steps | Expected Result | Pass/Fail |
|-------|-----------|---------------|-------|-----------------|-----------|
| TC-08-01 | Employee cannot see results before ACCEPT | Cycle in CONSULTATION | Employee navigates to Results | "Results not yet available. Check back soon." message shown | |
| TC-08-02 | Employee sees results in ACCEPT phase | Cycle in ACCEPT | Employee views results | Per-element averages, overall score, and anonymised comments displayed | |
| TC-08-03 | Manager sees team results in CONSULTATION | Cycle in CONSULTATION | Manager views direct report results | Aggregated results visible for all direct reports | |
| TC-08-04 | HR Admin filters results by department | Admin results page | Filter by "Delivery & Technology" | Only employees in that department shown | |
| TC-08-05 | HR Admin sorts by score | Admin results page | Sort by overall score descending | Employees ranked from highest to lowest score | |

---

### TC-09 — Dashboard & Navigation

| TC ID | Test Case | Pre-condition | Steps | Expected Result | Pass/Fail |
|-------|-----------|---------------|-------|-----------------|-----------|
| TC-09-01 | Admin dashboard shows cycle stats | Cycle in REVIEW | Login as HR Admin | Dashboard shows: cycle name, phase, % nominations, % reviews completed | |
| TC-09-02 | Manager dashboard shows team progress | Cycle in REVIEW | Login as Line Manager | Team review completion % and approval queue shown | |
| TC-09-03 | Employee dashboard shows pending actions | Nominations not submitted | Login as Employee | Pending nomination badge visible; "Submit Nominations" call to action | |
| TC-09-04 | Pending review badge count | 3 reviews outstanding | Login as Reviewer | Navigation badge shows "3" on Reviews menu item | |
| TC-09-05 | Navigation items match role | Login as Employee | Inspect navigation menu | No Admin-only items (Employee Management, Cycle Management) visible | |

---

### TC-10 — Non-Functional Requirements

| TC ID | Test Case | Steps | Expected Result | Pass/Fail |
|-------|-----------|-------|-----------------|-----------|
| TC-10-01 | Cold start under 1 minute | Fresh machine: `npm install` → `npm run dev` | App ready to serve requests within 60 seconds | |
| TC-10-02 | Page response time | Load dashboard page 5 times | All responses < 1 second | |
| TC-10-03 | AI response time | Trigger AI comment suggestion | AI response returned within 5 seconds | |
| TC-10-04 | No hardcoded secrets | Run linter / grep for secrets | No API keys or passwords in source code | |
| TC-10-05 | Input sanitisation — XSS | In a comment field, enter `<script>alert(1)</script>` | Script not executed; stored and displayed as plain text | |
| TC-10-06 | SQL injection prevention | In a search field, enter `' OR '1'='1` | No data leakage; query returns empty or expected results | |
| TC-10-07 | README completeness | Open README.md on fresh checkout | Contains: setup instructions, tech stack, team members, how to run locally | |
| TC-10-08 | Mobile responsiveness (MVP 2) | Open app on 375px wide screen (iPhone) | All pages usable; no horizontal scrolling required | |

---

## 📊 Summary

| Category | Count |
|----------|-------|
| **Epics** | 13 |
| **User Stories (MVP 1)** | 24 |
| **User Stories (MVP 2 / Custom)** | 13 |
| **Test Cases** | 72 |
| **Employees in dataset** | 57 (Delivery & Technology, Executives, Finance, Marketing, IT, People, Facilities, Talent Sourcing) |

---

## 🔄 Review Cycle Lifecycle

```
DRAFT → NOMINATE → APPROVE → REVIEW → CALCULATION → CONSULTATION → ACCEPT → CLOSED
  |          |          |        |           |               |           |        |
Admin     Employee   Manager  Employee   System          Manager    Employee  Admin
creates  nominates  approves  submits  calculates      views team   views    closes
cycle     peers     nominees  reviews   averages        results     results   cycle
```

---

## 🏷️ Jira Labels Reference

| Label | Applied To |
|-------|-----------|
| `mvp1` | All EP-01 through EP-07 stories |
| `mvp2` | EP-08 through EP-13 stories |
| `hitl` | US-10-01, US-10-02 (AI features requiring human review) |
| `ibm` | All stories for the IBM Bob team's Jira board (`HACK2` project) |
| `custom-feature` | Any story beyond the specification |

---

## 📁 Jira Project Reference

- **Project Key:** `HACK2`
- **Issue Types:** Epic, Story, Task, Bug
- **Repository:** [https://bitbucket.org/ovmobile/hackathon-v2-ibm](https://bitbucket.org/ovmobile/hackathon-v2-ibm)
- **Branch strategy:** `main` (stable) + feature branches

---

## 🚀 What We Do Next

> This section covers the four execution phases for the IBM Bob team during the hackathon: **Plan → Build → Execute → Demo**.

---

## PHASE 1 — PLAN (09:00 – 09:30)

**Goal:** Align the team on scope, ownership, and the working approach before writing a single line of code.

### 1.1 Team Alignment Checklist

- [ ] Confirm all team members have Bitbucket access to [`hackathon-v2-ibm`](https://bitbucket.org/ovmobile/hackathon-v2-ibm)
- [ ] Confirm Jira project `HACK2` is accessible and labels (`mvp1`, `mvp2`, `hitl`, `ibm`) are created
- [ ] Assign role owners:
  - **Tech Lead** — architecture decisions, code review, database schema
  - **Frontend Developer** — Next.js pages, forms, navigation, RBAC UI
  - **Backend Developer** — API routes, business logic, score calculation
  - **QA / Tester** — run test cases, document HITL interventions
  - **Presenter / BA** — demo script, slide deck, assessment report
- [ ] Agree on the tech stack: **Next.js 14 (App Router)** + **PostgreSQL (via Prisma)** + **JWT sessions**
- [ ] Set up shared `.env` file template and distribute locally
- [ ] Create `main` branch; each member creates their feature branch (`feature/EP-01-auth`, etc.)

### 1.2 MVP 1 Story Prioritisation

Sequence the MVP 1 epics in build dependency order:

| Order | Epic | Why First |
|-------|------|-----------|
| 1 | **EP-01** Auth & User Management | Everything depends on logged-in users and RBAC |
| 2 | **EP-02** Review Cycle Management | Cycles gate all nomination and review activity |
| 3 | **EP-03** Nomination Management | Nominations feed into approvals and reviews |
| 4 | **EP-04** Nomination Approval | Approvals must be done before reviews open |
| 5 | **EP-05** Employee Review & Rating | Core value delivery — the review form |
| 6 | **EP-06** Score Calculation & Results | Depends on completed reviews |
| 7 | **EP-07** Dashboards & Navigation | Wraps all flows in a usable UI |

### 1.3 Seed Data Plan

Use `Employees Export 31 Jul 2026.xlsx` (57 employees) to seed the database on startup:

- Map columns: Key → id, First Name + Last Name → name, Email → email, Department → department, Manager → managerId (resolved by name), Job Grade → jobGrade
- Identify and flag 3 employees with no manager assigned (contractors: Christian Parey, Esaie Mpoyi, Samuel Barden)
- Create 1 default HR Admin account: `admin@ovationsgroup.com` / change on first login
- Pre-load all 5 eWay elements with their 25 sub-questions as seed data

### 1.4 HITL Intervention Log Setup

Create `docs/hitl/hitl-log.md` in the repo immediately. Document every AI-generated output that a human reviewed, corrected, or overrode. **Minimum 3 required for judging.**

| # | Type | Description | AI Output | Human Change | Timestamp |
|---|------|-------------|-----------|--------------|-----------|
| 1 | TBD | TBD | TBD | TBD | TBD |
| 2 | TBD | TBD | TBD | TBD | TBD |
| 3 | TBD | TBD | TBD | TBD | TBD |

---

## PHASE 2 — BUILD (09:30 – 12:00 · MVP 1 + 12:45 – 14:45 · MVP 2)

**Goal:** Deliver a working, locally runnable application from the spec.

### 2.1 MVP 1 Build Tasks (Morning Sprint)

#### Sprint 1A — Foundation (09:30 – 10:30)

| Task | Owner | Story | Done When |
|------|-------|-------|-----------|
| Initialise Next.js project + Prisma + PostgreSQL | Tech Lead | EP-01 | `npm run dev` works locally |
| Define full DB schema (all 8 entities) | Tech Lead | EP-01–06 | `prisma migrate dev` runs clean |
| Seed database from XLSX employee data | Backend Dev | EP-09 / US-09-01 | 57 employees visible in DB |
| Implement JWT login + logout | Backend Dev | US-01-01 | `/login` page works |
| Implement RBAC middleware | Backend Dev | US-01-02 | Unauthorised routes return 403 |

#### Sprint 1B — Cycle & Nominations (10:30 – 11:30)

| Task | Owner | Story | Done When |
|------|-------|-------|-----------|
| Create/list review cycles (Admin UI) | Frontend Dev | US-02-01 | Admin can create "H1 2026" cycle |
| Cycle phase advancement | Backend Dev | US-02-02 | Admin can advance DRAFT → NOMINATE |
| Nomination page — inbound & outbound | Frontend Dev | US-03-01, US-03-02 | Employee can select peers |
| Lock manager in nomination | Backend Dev | US-03-03 | Manager field cannot be removed |
| Min/max enforcement | Backend Dev | US-03-04 | Submit blocked below min |
| Save draft nominations | Backend Dev | US-03-05 | Draft persists on page reload |

#### Sprint 1C — Reviews & Results (11:30 – 12:00)

| Task | Owner | Story | Done When |
|------|-------|-------|-----------|
| Manager approval screen | Frontend Dev | US-04-01, US-04-02 | Manager can approve/reject nominees |
| Review form — all 25 criteria + 3 additional questions | Frontend Dev | US-05-02–US-05-05 | All fields rendered and validated |
| Submit + lock review | Backend Dev | US-05-07 | Submitted review is read-only |
| Score calculation engine | Backend Dev | US-06-01, US-06-02 | Averages correct to 2 dp |
| Results pages (Employee + Manager + Admin) | Frontend Dev | US-06-03–US-06-05 | Results visible per role |
| Role-aware dashboards + nav badges | Frontend Dev | US-07-01–US-07-03 | All 3 role dashboards functional |

### 2.2 MVP 2 Build Tasks (Afternoon Sprint)

| Priority | Task | Story | Bonus Points |
|----------|------|-------|-------------|
| 🥇 High | Employee data XLSX import UI | US-09-01 | Practical + demo-able |
| 🥇 High | eWay criteria management (Admin CRUD) | US-08-02 | Simple extension of seed data |
| 🥈 Medium | AI comment suggestions (Bob/watsonx) | US-10-01 | Scores `hitl` + `effective-ai` rubrics |
| 🥈 Medium | AI feedback theme summary | US-10-02 | Scores `hitl` + `effective-ai` rubrics |
| 🥉 Nice | PDF report download | US-11-01 | Strong demo moment |
| 🥉 Nice | Audit trail | US-12-02 | Satisfies compliance story |
| 🥉 Nice | Mobile responsive UI | — | Easy wins if using Tailwind |
| ⭐ Custom | Department heatmap | US-11-03 | Visual wow factor for judges |

### 2.3 Recommended Repo Structure

```
hackathon-v2-ibm/
├── README.md                    ← setup instructions, tech stack, team, how to run
├── src/
│   ├── app/                     ← Next.js App Router pages
│   │   ├── (auth)/login/
│   │   ├── admin/               ← HR Admin pages
│   │   ├── manager/             ← Line Manager pages
│   │   └── employee/            ← Employee pages
│   ├── components/              ← Shared React components
│   ├── lib/                     ← DB client, auth helpers, calculation engine
│   └── api/                     ← Next.js API route handlers
├── prisma/
│   ├── schema.prisma            ← Full entity schema
│   └── seed.ts                  ← Employee + eWay criteria seed
├── database/
│   └── migrations/
├── docs/
│   ├── prompts/                 ← Log of AI prompts used
│   ├── hitl/hitl-log.md         ← HITL intervention log (mandatory)
│   ├── architecture.md          ← Architecture diagram + decisions
│   └── assessment-report.md    ← Self-assessment for judging
└── tests/
    └── *.test.ts                ← Unit tests for calculation engine + RBAC
```

### 2.4 Definition of Done (per story)

A story is only marked **Done** when:
- [ ] Feature works end-to-end in the browser on localhost
- [ ] RBAC enforced — no other role can access the feature
- [ ] Basic input validation in place (no empty submits, no XSS)
- [ ] Code committed and pushed to feature branch
- [ ] PR merged to `main` (peer reviewed by at least one teammate)
- [ ] Relevant test case(s) from Section TC-XX manually verified and ticked

---

## PHASE 3 — EXECUTE (Continuous throughout the day)

**Goal:** Keep the team moving, unblocked, and aligned — and capture evidence for judging.

### 3.1 Hourly Sync Checkpoints

| Time | Checkpoint |
|------|-----------|
| 10:30 | Is DB running + login working? If not, stop and fix before building on top. |
| 11:30 | Is the nomination flow end-to-end functional? Adjust scope if behind. |
| 12:00 | MVP 1 feature freeze. What is working? What is cut? Update Jira. |
| 13:30 | MVP 2 priority call — drop anything not 80% done; focus on demo quality. |
| 14:30 | Feature freeze. Switch all effort to demo prep and rehearsal. |

### 3.2 Scope Management Rules

- If a feature will not be finished, **stub the UI with a "Coming Soon" label** — do not leave broken pages
- Prioritise **breadth over depth**: a working shallow flow beats a deep broken one
- The calculation engine accuracy is **non-negotiable** — judges will verify the maths
- All HITL interventions must be **logged before 14:30**

### 3.3 Quality Gates

| Gate | Check | When |
|------|-------|------|
| Auth works | All 3 role logins land on correct dashboard | After Sprint 1A |
| Nomination locked | Manager cannot be removed from reviewer list | After Sprint 1B |
| Calculation correct | Manually verify TC-07-01 through TC-07-03 with known test data | After Sprint 1C |
| Anonymity enforced | Employee results show no reviewer names | Before demo |
| No console errors | Browser DevTools shows no JS errors on main flows | Before demo |
| Cold start < 60s | Fresh `npm install` + `npm run dev` timed | Before demo |

### 3.4 Evidence to Capture for Judging

| Evidence | Where to Store | Judge Criterion |
|----------|---------------|----------------|
| HITL log with ≥ 3 interventions | `docs/hitl/hitl-log.md` | Human-in-the-Loop (10%) |
| AI prompt log | `docs/prompts/` | Effective use of AI (10%) |
| Architecture diagram | `docs/architecture.md` | Design & Non-Functional (10%) |
| Unit tests for calculation engine | `tests/` | Code quality (10%) |
| Assessment report | `docs/assessment-report.md` | Self-assessment deliverable |
| Source code on Bitbucket | `main` branch | Code quality (10%) |

---

## PHASE 4 — DEMO SCRIPT (14:45 – 16:00 · 15 minutes)

**Goal:** Tell a compelling story, show a working product, and score maximum points across all judging criteria.

---

### 🎬 Demo Script — eWay 360° Review (IBM Bob Team)

**Duration:** 15 minutes  
**Roles needed:** Presenter (1), Driver/Laptop operator (1), optional Narrator (1)

---

#### ⏱ 00:00 – 01:30 · Opening — Problem Statement

> *"At Ovations, we run 360° performance reviews every 6 months. Today that process lives in spreadsheets, email chains, and shared Google Docs. It's manual, error-prone, and employees have no real-time visibility into where they stand. We built eWay 360° — a purpose-built internal review platform — in a single day using IBM Bob."*

- Show the **login page** (branded, clean)
- Briefly mention the tech: Next.js, PostgreSQL, JWT, IBM watsonx AI

---

#### ⏱ 01:30 – 03:30 · Act 1 — HR Administrator Flow

**Login as:** `admin@ovationsgroup.com`

1. Show the **Admin Dashboard** — active cycle "H1 2026", current phase, % nominations in, % reviews done
2. Navigate to **Employees** — show the imported 57 Ovations employees (from the XLSX seed)
3. Navigate to **Review Cycles** — show "H1 2026" in NOMINATE phase
4. Advance the cycle from NOMINATE → APPROVE (live, with confirmation dialog)
5. *"The Admin is in full control of the lifecycle at all times."*

---

#### ⏱ 03:30 – 06:00 · Act 2 — Employee Nomination Flow

**Login as:** `GerritV@OvationsGroup.com` *(Gerrit Van Milligen — Delivery & Technology)*

1. Show the **Employee Dashboard** — "You have 1 pending action: Submit Nominations"
2. Open the **Nomination Page**
3. Point out: *"Hannes Van Der Walt is pre-selected as Gerrit's manager and cannot be removed — this is a mandatory business rule."*
4. Add 3 additional peers from the directory (search and select)
5. Click **Save Draft** — "Gerrit needs to think about one more person"
6. Add a 4th peer; click **Submit Nominations**
7. Show the **Nomination Summary** page — inbound, outbound, statuses

---

#### ⏱ 06:00 – 07:30 · Act 3 — Manager Approval Flow

**Login as:** `hannesv@ovationsgroup.com` *(Hannes Van Der Walt — Line Manager)*

1. Show the **Manager Dashboard** — "1 team member's nominations pending approval"
2. Open Gerrit's nomination card — see the 4 nominated peers
3. **Approve** 3 nominees; **Reject** 1 (explain: "This person didn't work with Gerrit this cycle")
4. *"Gerrit is notified and can now add another nominee to meet the minimum."*

---

#### ⏱ 07:30 – 10:30 · Act 4 — Review & Rating Flow

**Login as:** `philipn@ovationsgroup.com` *(Phillip Nelson — Reviewer)*

1. Show the **Reviews Dashboard** — pending reviews list with Gerrit's card showing "Not Started"
2. Open the **Review Form** for Gerrit
3. Walk through one full eWay element (e.g. MASTERFUL) — rate all 5 sub-questions
4. Show the **rating scale labels** (1 = Needs Significant Improvement → 5 = Exceptional)
5. *(If MVP 2 AI is built)* Click **"Suggest Comments"** — AI generates draft feedback based on ratings
   - *"This is our Human-in-the-Loop moment — Phillip reviews the AI suggestion, edits one sentence, and accepts it."*
   - Show the HITL log entry being made
6. Fill the "What they do well" and "What they need to improve" comments manually or via AI assist
7. Answer the 3 additional questions (text + Yes/No)
8. Click **Submit** → Confirm → Review locked

---

#### ⏱ 10:30 – 12:30 · Act 5 — Results & Insights

**Login as:** `GerritV@OvationsGroup.com` *(after cycle advanced to ACCEPT)*

1. Show the **Results Page** — per-element averages, overall score (e.g. 3.87)
2. Point out: *"Based on 4 reviews — no reviewer names shown, fully anonymised"*
3. Show anonymised comments under "What they do well" and "What they need to improve"
4. *(If MVP 2 AI theme summary built)* Show the AI-generated theme summary: "Top strengths: delivery, teamwork. Focus area: communication."

**Switch to HR Admin view:**

5. Show the **All Results** page — filter by "Delivery & Technology", sort by score
6. *(If heatmap built)* Show the **Department Heatmap** — colour-coded by criterion

---

#### ⏱ 12:30 – 13:30 · Act 6 — Architecture Walkthrough

*Presenter switches to the architecture diagram (`docs/architecture.md`)*

1. **Frontend:** Next.js App Router — server components + client components
2. **Backend:** Next.js API routes — RESTful endpoints per domain (auth, cycles, nominations, reviews, results)
3. **Database:** PostgreSQL via Prisma ORM — 8 entities, foreign keys, indexes on cycleId + employeeId
4. **Auth:** JWT stored in HTTP-only cookie — no passwords in DB (SSO-ready)
5. **AI Layer:** IBM watsonx.ai — prompt-based comment suggestions and theme summarisation
6. *"The entire stack runs on a single laptop with one `npm run dev` command."*

---

#### ⏱ 13:30 – 15:00 · Act 7 — IBM Bob as the AI Platform

1. Show **3 HITL interventions** from `docs/hitl/hitl-log.md`:
   - Example 1: Bob generated the score calculation logic; team corrected the rounding approach (2 dp per spec)
   - Example 2: Bob suggested a UI layout for the review form; team restructured it to group by eWay element
   - Example 3: Bob generated a DB schema without the `direction` field on Nomination; team added it per spec
2. Show the **prompt log** (`docs/prompts/`) — how many prompts were used, what roles Bob played (Dev, Architect, QA, BA)
3. *"Bob acted as Developer, Database Architect, Test Case Generator, and Business Analyst today."*

---

#### ⏱ 15:00 – 15:00 · Closing

> *"In one day, using IBM Bob, we delivered a fully functional 360° performance review application for Ovations — with role-based access, a full review lifecycle, anonymised results, and AI-assisted feedback. The code is on Bitbucket, the DB is seeded with real Ovations employees, and it runs locally right now. Thank you."*

---

### 📋 Demo Day Checklist (Complete before 14:45)

- [ ] Application running on presenter's laptop (`npm run dev` — no errors in terminal)
- [ ] Database seeded: 57 employees, H1 2026 cycle in correct phase for demo
- [ ] At least 3 demo user accounts tested: admin, manager (`hannesv`), employee (`GerritV`)
- [ ] Pre-submitted reviews in place so results page has data to show
- [ ] HITL log has ≥ 3 documented interventions
- [ ] Architecture diagram saved as image in `docs/`
- [ ] Presentation slides ready (Sales Intro + Architecture + Self-Assessment)
- [ ] Screen resolution set to ≥ 1280px; browser zoom at 100%
- [ ] Kill all notifications on presenter's laptop
- [ ] Backup laptop or screen-share from a second machine ready

---
