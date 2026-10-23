# Pulse360 Runtime Bug Fixes - 2026-08-08

## Issues Addressed

- Sign out redirected users to `https://pulse.onrender.com/login`, which returned `Not Found`.
- Nomination reviewer search was restricted by department, causing valid reviewers to be hidden when department data was wrong or too narrow.
- Approval and review pages could disagree about active work because several APIs used non-deterministic `findFirst` cycle lookups.
- Line-manager dashboard, sidebar, and approvals page counts could disagree about pending work.
- Line-manager approval visibility needed to follow the direct-report ownership rule, not the nominated-reviewer rule.
- HR admins needed an audit trail for nomination, approval, rejection, and review transactions.
- MVP 2 needs a separate System Admin persona for platform adoption, audit, AI usage, and behavioral metadata monitoring without exposing review scores/comments.
- HR report export and self-improvement CSV export attempted to write files to a hard-coded server-side Windows path.
- Users needed a self-service way to edit basic profile details.
- MVP 2 analytics needed cleaner event tables instead of storing every downstream metric only in `audit_log`.
- HR needed editable workforce dimensions for job grade, employment type, conversion-hire status, gender, and ethnicity.

## Fixes Applied

- Sign out now clears the session without external redirect handling, then routes to `/login` on the current host.
- Non-HR nomination search now shows active non-HR colleagues, excluding the current user and already selected reviewers.
- Cycle lookups for nominations, approvals, and reviews now order by newest cycle first.
- Line-manager approval visibility now includes only nominations for employees who directly report to that manager.
- Review assignments remain reviewer-based after approval, so nominated reviewers can review every approved peer assigned to them.
- Dashboard and sidebar badges now share the same workflow counts for pending approvals, nominations, and review assignments.
- Added structured audit events for nomination creation, removal, submission, approval, rejection, bulk approval, review draft saves, and review submissions.
- Retired the earlier HR-only `/admin/audit` detail view so platform monitoring sits with the new System Admin persona instead.
- Added a separate `SYSTEM_ADMIN` role with a seeded Platform Operations account.
- Moved platform audit analytics into a privacy-preserving `/system-admin` dashboard and retired the old HR audit page into a redirect.
- Added audit tracking for login success/failure, profile updates, AI generation calls, AI token metadata, and review AI human-in-the-loop choices.
- Excluded System Admin accounts from HR-managed employee lists and nomination reviewer pools.
- Report export now opens a print-ready executive report so HR can save the reviewed HTML preview as a PDF with cards, department dashboard bars, criteria dashboard bars, and narrative.
- The HR report preview now includes the same executive analytics dashboard context before approval, not only the AI narrative.
- CSV export now creates a browser-side CSV download instead of writing to `C:\Users\...`.
- Added `/profile` and `/api/profile` so users can edit first name, last name, email, and job title.
- Removed `next/font/google` usage so production builds do not depend on fetching Google Fonts.
- Added dedicated event projection tables for auth, profile updates, AI usage, AI HITL decisions, nominations, and reviews while keeping `audit_log` as the immutable governance feed.
- Added HR-editable employee workforce fields: `employment_type`, `conversion_hire_status`, `gender`, and `ethnicity`.
- Seeded realistic workforce and gender segments for MVP 2 dashboards: 44 permanent, 6 learnership, 3 internship, 4 contract; 33 male, 19 female, 5 other across non-system employees.
- Updated the System Admin dashboard to read login and AI token metrics from the dedicated event tables and show aggregated gender/employment context without exposing ethnicity.

## Verification

- `npm run typecheck` passed.
- `npm run build` no longer fails on Google Fonts, but the local Windows install still lacks `lightningcss.win32-x64-msvc.node`. A clean `npm ci` should restore the native package locally; GitHub Actions and Render perform clean installs.

## Follow-Up Checks After Deploy

- Confirm sign out from `https://pulse360-gkt8.onrender.com` lands on `https://pulse360-gkt8.onrender.com/login`.
- Log in as Mpho Zulu and confirm active non-HR colleagues appear in nomination search.
- Log in as Hlanganani Oosthuizen during the approval phase and confirm the dashboard, sidebar, and approvals page show the same pending direct-report nominations.
- Log in as a nominated reviewer during the review phase and confirm all approved peer review assignments appear under My Reviews.
- Confirm Hlanganani, Xolile, Zanele, and other line-manager dashboards match their direct-report approval queues.
- Visit `/admin/audit` as HR Admin and confirm new nomination, approval, rejection, and review activity appears with actor, employee, reviewer, and department context.
- Log in as `system.admin@techcorp.co.za` with the temporary password and confirm `/system-admin` opens with aggregated adoption, approval health, behavioral network, AI usage, and governance-event panels.
- Confirm HR Admin can no longer access a detailed `/admin/audit` relationship table and that System Admin does not see review scores or review comments.
- Use Print / Save PDF on an HR analytics report and confirm the saved PDF includes the reviewed visual report content.
- Confirm the HR report preview includes score cards and analytics bar charts before approval.
- Download a self-improvement plan and confirm the file is a `.csv`.
- Visit My Profile and confirm basic details can be saved.
- As HR Admin, create or edit an employee and confirm job grade, employment type, conversion-hire status, gender, and ethnicity persist.
- As System Admin, confirm adoption, AI token, gender, and employment mix cards update without showing employee-level ethnicity.
