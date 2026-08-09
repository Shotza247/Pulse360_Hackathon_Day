# Pulse360 Runtime Bug Fixes - 2026-08-08

## Issues Addressed

- Sign out redirected users to `https://pulse.onrender.com/login`, which returned `Not Found`.
- Nomination reviewer search was restricted by department, causing valid reviewers to be hidden when department data was wrong or too narrow.
- Approval and review pages could disagree about active work because several APIs used non-deterministic `findFirst` cycle lookups.
- Line-manager dashboard, sidebar, and approvals page counts could disagree about pending work.
- Line-manager approval visibility needed to follow the direct-report ownership rule, not the nominated-reviewer rule.
- HR admins needed an audit trail for nomination, approval, rejection, and review transactions.
- HR report export and self-improvement CSV export attempted to write files to a hard-coded server-side Windows path.
- Users needed a self-service way to edit basic profile details.

## Fixes Applied

- Sign out now clears the session without external redirect handling, then routes to `/login` on the current host.
- Non-HR nomination search now shows active non-HR colleagues, excluding the current user and already selected reviewers.
- Cycle lookups for nominations, approvals, and reviews now order by newest cycle first.
- Line-manager approval visibility now includes only nominations for employees who directly report to that manager.
- Review assignments remain reviewer-based after approval, so nominated reviewers can review every approved peer assigned to them.
- Dashboard and sidebar badges now share the same workflow counts for pending approvals, nominations, and review assignments.
- Added structured audit events for nomination creation, removal, submission, approval, rejection, bulk approval, review draft saves, and review submissions.
- Added an HR-only System Audit dashboard at `/admin/audit` showing current-cycle totals, who nominated who, most-nominated reviewers, department nomination flow, review activity, and recent transaction logs.
- Report export now opens a print-ready executive report so HR can save the reviewed HTML preview as a PDF with cards, department dashboard bars, criteria dashboard bars, and narrative.
- The HR report preview now includes the same executive analytics dashboard context before approval, not only the AI narrative.
- CSV export now creates a browser-side CSV download instead of writing to `C:\Users\...`.
- Added `/profile` and `/api/profile` so users can edit first name, last name, email, and job title.
- Removed `next/font/google` usage so production builds do not depend on fetching Google Fonts.

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
- Use Print / Save PDF on an HR analytics report and confirm the saved PDF includes the reviewed visual report content.
- Confirm the HR report preview includes score cards and analytics bar charts before approval.
- Download a self-improvement plan and confirm the file is a `.csv`.
- Visit My Profile and confirm basic details can be saved.
