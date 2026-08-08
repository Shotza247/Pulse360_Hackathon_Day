# Pulse360 Runtime Bug Fixes - 2026-08-08

## Issues Addressed

- Sign out redirected users to `https://pulse.onrender.com/login`, which returned `Not Found`.
- Nomination reviewer search was restricted by department, causing valid reviewers to be hidden when department data was wrong or too narrow.
- Approval and review pages could disagree about active work because several APIs used non-deterministic `findFirst` cycle lookups.
- Line managers could miss pending approval rows where they were the requested reviewer.
- HR report export and self-improvement CSV export attempted to write files to a hard-coded server-side Windows path.
- Users needed a self-service way to edit basic profile details.

## Fixes Applied

- Sign out now clears the session without external redirect handling, then routes to `/login` on the current host.
- Non-HR nomination search now shows active non-HR colleagues, excluding the current user and already selected reviewers.
- Cycle lookups for nominations, approvals, and reviews now order by newest cycle first.
- Line-manager approval visibility now includes both direct-report nominations and nominations where the manager is the selected reviewer.
- Report export now creates a browser-side PDF download with executive narrative, department dashboard bars, and criteria dashboard bars.
- CSV export now creates a browser-side CSV download instead of writing to `C:\Users\...`.
- Added `/profile` and `/api/profile` so users can edit first name, last name, email, and job title.
- Removed `next/font/google` usage so production builds do not depend on fetching Google Fonts.

## Verification

- `npm run typecheck` passed.
- `npm run build` no longer fails on Google Fonts, but the local Windows install still lacks `lightningcss.win32-x64-msvc.node`. A clean `npm ci` should restore the native package locally; GitHub Actions and Render perform clean installs.

## Follow-Up Checks After Deploy

- Confirm sign out from `https://pulse360-gkt8.onrender.com` lands on `https://pulse360-gkt8.onrender.com/login`.
- Log in as Mpho Zulu and confirm active non-HR colleagues appear in nomination search.
- Log in as Hlanganani Oosthuizen during approval/review phases and confirm assigned pending work appears.
- Download an HR analytics report and confirm the file is a `.pdf`.
- Download a self-improvement plan and confirm the file is a `.csv`.
- Visit My Profile and confirm basic details can be saved.
