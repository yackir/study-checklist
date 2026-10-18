# Academic semesters and accounts

Rollback reference: `backup/pre-semesters-2026-10-18` (commit ccfb524).
Legacy localStorage keys and the study_checks table are preserved. New workspaces
use separate per-account storage keys and a new RLS-protected study_workspaces table.
Reverting code does not delete the new workspace data, but the old UI cannot display it.
Export a workspace backup before reverting. Revert the feature commit normally; do
not reset or force-push main. No database rollback is needed.

## Authentication activation

The frontend supports persistent Supabase sessions, Google OAuth and email magic
links (PKCE). The current project has email enabled and Google disabled.

1. In Supabase Auth URL Configuration, set Site URL to the deployed site and allow
   that exact site's root URL as a redirect URL (plus preview URLs only if needed).
2. For Google, create a Web application OAuth client in Google Cloud. Set its
   authorized redirect URI to the Supabase callback displayed by the Google provider.
   Save the client ID and client secret in Supabase Auth > Providers > Google.
   Enable manual identity linking for upgrading existing anonymous accounts.
3. Existing anonymous users can also link their email. An email already used by a
   different account is deliberately not merged automatically.
4. Test real OAuth and email return flows in Safari AND in the installed iOS PWA.
   PKCE email links must open in the initiating browser/storage context.
5. Invitation-only access for the five testers is a separate next step. This commit
   does not claim that registration has been restricted to five people.

If Google is disabled, the button remains disabled with an explanation. Email
sending uses the project's mail provider and its rate limits. No client secrets
belong in the repository or the browser.

## Data and calendar

The verified calendar currently covers Haifa 5787 (2026–27), semesters A/B/summer.
Source: https://mt.haifa.ac.il/wp-content/uploads/2025/12/mat-3-%D7%AA%D7%A9%D7%A4%D7%96.pdf
Other institutions/years use explicit manual dates, never inferred dates.
Existing users retain their original 2026-10-11–2027-02-10 range until they opt into
the official dates. Semester B and summer start midweek; the weekly grid is Sunday
anchored while excluding course dates outside the teaching period.

Workspaces are saved locally immediately, then uploaded with an optimistic revision
check. Concurrent edits on another device stop upload rather than overwrite data.
Export a local backup before resolving a conflict. Notes/photos are included in the
workspace (12 MB server cap, browser storage limit may be lower). Reminders use all
semester dates, not whichever semester is currently being viewed.

Manual smoke checks: existing local data upgrade; new account with no default courses;
create/edit/switch semesters; all-semester export/import; Monday/Thursday starts;
login/reload/logout/account switch; offline cached use; RLS ownership; reminder boundary.

## Semester picker update (2026-10-18)

Rollback branch: `backup/pre-semester-pickers-2026-10-18` (a25f788).
New semester year choices are the current Hebrew year in Asia/Jerusalem and the
previous year only. Existing out-of-range semesters retain their original year
when edited; they do not add options to the new-semester picker.
Institution suggestions are a bundled search directory in institutions.js,
including aliases. It works offline and still permits free-text institutions.
Directory membership does not imply verified calendar dates. Source references
are recorded at the top of institutions.js; updates are manual, not live sync.
All three fields use anchored, theme-aware lists with keyboard navigation.
No backend or account schema changes are required. Service worker cache is v22.
