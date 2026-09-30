# Eggsplore: step-by-step setup and remaining work

## 1. Use the corrected project

Keep your original folder as a backup. Extract `eggsplore-travel-planner-fixed.zip` into a NEW folder. Open the extracted `eggsplore-travel-planner` folder in VS Code. Do not copy this over your existing folder: the old `src/app/tabs`, `src/app/trips/page.tsx` and misplaced login file must not remain alongside the corrected routes.

The repair updates Next.js 14.2.35 / React 18.3.1 to Next.js 16.3.7 / React 19.3.0, with matching React types. The prior dependency audit reported one critical and one high issue; the corrected lockfile reports zero. Tailwind stays on v3.4.17. Tell your teammates about the framework change before merging it. `archiutecture.md` remains the original reference; its version and colour table are stale. The actual centralized colour contract is `src/styles/theme.ts`.

The build/dev scripts use Webpack explicitly. Turbopack could not run its compiler subprocess in the checking environment; Webpack completed the production build. `npm run lint` currently checks TypeScript only; there is no ESLint configuration.

## 2. Check Node and install

Open VS Code → Terminal → New Terminal. These are PowerShell commands:

```powershell
node --version
npm --version
```

Use Node 22 or newer. Then, from the folder containing `package.json`:

```powershell
npm ci
npm list next react react-dom
npm run typecheck
npm audit
```

Expected versions: Next 16.3.7, React/React DOM 19.3.0. Typecheck should exit without diagnostics. The audit was zero at the time of checking; newer advisories can change that. Do not independently downgrade Next to 14 or install mismatched React versions. Do not use `--force` or `--legacy-peer-deps` to bypass a conflict.

If `npm ci` says the lockfile is out of sync, first ensure you extracted the supplied package.json AND package-lock.json together. The supplied pair was validated. If VS Code still displays old errors: Ctrl+Shift+P → TypeScript: Restart TS Server.

## 3. Configure Supabase

Create/open your Supabase project. Copy its project URL and browser-safe publishable key (or legacy anon key). In the corrected project root:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and replace both placeholders:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

The second variable can contain a publishable key even though its name says ANON_KEY. Never use a service-role or secret key here. Restart the dev server after any env change. Before real values are supplied, Login displays a setup message and disables authentication; this is expected.

## 4. Create the database

The ZIP contains `supabase/migrations/001_foundation.sql`.

For a NEW/empty Supabase project: open SQL Editor → New query, paste the whole file, and Run once. It runs in one transaction. It creates profiles, trips, trip_members, expenses, itinerary_items, indexes, signup/profile triggers, automatic owner membership, updated_at triggers, RLS and policies.

If these tables already exist, DO NOT drop them or run the migration blindly. Compare the current schema first and create an incremental migration. The supplied file intentionally fails on existing objects instead of replacing data.

After successful setup, Table Editor should show five tables. Run `supabase/verify-foundation.sql` to inspect the RLS flags and policies. This inspection does not prove user isolation by itself: repeat the two-account checks below against your real Supabase instance.

Current permission contract:
- Users read/update their own profile, including private preferences/emergency contact fields.
- Trip owner creates/edits/deletes trips and adds/removes ordinary members.
- Trip members read their trip, members, expenses and itinerary.
- Owner manages expenses/itinerary. Other members cannot write these yet.
- Users cannot self-join, promote roles or transfer ownership.
- Public profile/member directory, invitation acceptance and richer member editing require additional design.

## 5. Configure authentication redirects

In Supabase → Authentication → URL Configuration:

- Site URL: `http://localhost:3000`
- Additional redirect URL: `http://localhost:3000/home`

If you use a different origin or port, add that exact `/home` URL too. This project uses the standard Supabase browser client with persisted browser sessions and direct `/home` redirects; it does not use cookie-based SSR/PKCE callback handlers. The client login guard controls UI access; database RLS controls data access. Future API routes/server actions must validate the user separately.

Enable Email authentication. Configure the email service/template and sending limits appropriate for your project. The default magic-link template should use Supabase's confirmation URL; a custom token_hash/PKCE template would require a corresponding callback implementation.

## 6. Enable Google sign-in

In Google Cloud Console:
1. Create/select the project and configure the OAuth consent screen.
2. Create an OAuth client of type Web application.
3. Set the authorized JavaScript origin to `http://localhost:3000`.
4. Set the authorized redirect URI to the callback URL shown in Supabase's Google provider panel, normally `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`.
5. Copy the client ID and client secret into Supabase → Authentication → Sign In / Providers → Google, and enable/save it.
6. If Google's app is in testing mode, add your testing email accounts as test users.

The Google callback is the SUPABASE callback; `/home` is the APP destination after Supabase completes sign-in. The browser should receive only the Supabase publishable/anon key, never the Google client secret.

## 7. Start and test in this order

```powershell
npm run dev
```

Open http://localhost:3000. Then:
1. `/` should take you to `/login`.
2. Before signing in, open `/home`, `/trips`, `/map` and `/profile`. They should take you back to `/login`.
3. Select “I'll use email”, enter a real email, and submit. Invalid email input should be rejected by the browser.
4. Open the magic link in the SAME browser and continue to `/home`. Check spam if the email does not arrive. Check Supabase email logs/rate limits if sending fails.
5. Test Google in a fresh signed-out session. You should return to `/home`.
6. Click Home, Trip, Map and Profile. Each should show the shared navigation and correct active tab.
7. Profile should show your email/name. Click Sign out; it should return to Login. Opening protected pages again should redirect.
8. Refresh Home while signed in. Session should persist.
9. In Supabase, confirm the new user has a profiles row.
10. Test a second account: it must not be able to read a trip until its owner adds it to trip_members. It must not be able to self-join or change ownership. The UI for creating trips/invitations is still pending, so run these checks with authenticated Supabase client requests or a role-aware test harness, not SQL Editor's privileged admin connection.

Client-side redirects do not turn static placeholder pages into private server-rendered pages. Keep sensitive content behind authenticated Supabase queries/RLS, and add server authorization if server endpoints are introduced.

When done, stop the dev server with Ctrl+C and verify production:

```powershell
npm run typecheck
npm run build
npm run start
```

## 8. What has been fixed

| Finding in upload | Correction |
|---|---|
| Login under src/features/auth/login/page.tsx is not a route | Moved to src/app/(auth)/login/page.tsx |
| tabs folder adds /tabs to URLs, breaking nav | Renamed to (tabs), so /home and /map resolve |
| Trips does not receive tab layout | Moved /trips into (tabs) |
| Profile link has no page | Added profile identity and sign-out handling |
| Tab pages have no login guard | Added session loading and unauthenticated redirect |
| Placeholder Supabase credentials crash/lead to unclear failures | Added explicit setup state and disabled sign-in until configured |
| Auth initialization/network rejection unhandled | Added error handling and session-listener cleanup |
| Login requests can leave loading state stuck on failure | Added catch/finally handling |
| Email input has no submit validation/label | Added labelled form with native email validation |
| UI promises phone login but only supports email | Changed label to email |
| Existing Login button only refreshes current page | Opens the email form |
| BottomSheet lacks focus containment/restoration | Uses native modal dialog with Escape/backdrop close |
| Security audit reports high/critical issues | Updated Next/React and matching type dependencies |
| No database setup in repository | Added transactional migration and RLS verification query |
| No reproducible setup instructions | Added this guide and .env.example |

## 9. What is still left out

### Module A: finish after setup
- Real Supabase credentials and applying the migration to YOUR project.
- Actual Google OAuth/email authentication and two-account permission testing.
- Exact Figma visual match: original logo asset, decorative waves, font and mobile spacing. The screenshot is a visual reference; the implementation still uses a text logo placeholder. Apple/Facebook/phone sign-in are not implemented.
- Home active/upcoming trip cards and real data queries.
- Profile preference and emergency-contact editing/saving UI; database fields exist, but the current page displays account identity only.
- A public member-name/avatar directory that does not reveal private profile fields.
- ESLint configuration if the team requires a separate lint check.

### Module B
Trip creation wizard, invitations/acceptance, preferences, activity candidates, votes, results, editable AI draft, itinerary persistence. Add schema/policies for candidates/votes/invitations; these are not in the foundation migration.

### Module C
Mapbox map/pins/route polylines and token setup, place data/vibe layers, location Ask AI, secure Gemini integration, weather integration, manual flight-delay demonstration and rescheduling. Automatic background flight monitoring and notification center remain stretch features. No service-role/Gemini/flight secrets belong in NEXT_PUBLIC variables.

### Module D
Expense forms/ledger, equal/custom splits, balances, payer/participant validation, currency handling, receipt metadata/storage policies, logistics/pricing mock data. The basic expenses table is not a complete split ledger. Decide whether members can write their own expenses and add author-based policies before enabling that.

### Integration
Realtime subscriptions/publication setup, loading/empty/error states, storage policies if uploads are added, demo data, end-to-end tests and deployment configuration. Supabase Realtime is not automatically configured by the migration.

## 10. Architecture decisions to align with the team

README/spec describe React Native + Expo/NativeWind, while the uploaded code and architecture file use Next.js web/Tailwind. This repair preserves the actual web application; it does not create an Expo app. Decide which is the final deliverable and update the documentation consistently.

The architecture file also lists older purple tokens (#7047EB etc.), while the uploaded theme uses #7E49C2 and related colours from the latest guidance. Keep one agreed theme contract. No Figma source was fetched during this repair, so exact Figma equivalence has not been verified.

requirements.txt contains Python dependencies, but this upload has no Python service. It is retained for your team to decide; you do not need pip install to run this Next.js foundation. AI/backend choices should be aligned before adding another service.

## 11. Verified and unverified

Verified here: compatible dependency tree, TypeScript check, production Webpack build, zero npm audit advisories at check time; foundation SQL creation and triggers; owner/member/outsider/anonymous access checks in an isolated PostgreSQL-compatible PGlite runtime.

Not verified here: real Google/email sign-in, live Supabase database deployment, real email delivery, live Realtime subscriptions, exact design fidelity, or the future Modules B–D. The browser download failed, so interactive browser checks (redirect execution, login form clicks and modal focus) were not completed here. HTTP smoke checks confirmed the route responses and root redirect. Local database tests emulate auth.users/auth.uid; your actual hosted Supabase instance still needs the checks in step 7.

Official references:
- https://vercel.com/changelog/next-js-may-2026-security-release
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/database/postgres/row-level-security
