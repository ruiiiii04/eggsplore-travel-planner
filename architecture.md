# Eggsplore architecture and team handoff
## Architecture directory tree

**Legend:** unmarked entries exist in the inspected ZIP; **[restore]** means missing from the ZIP but required for handoff; **[planned B/C/D]** means future work; **[add A]** means a Foundation handoff file to add. The obsolete ordinary `src/app/tabs/` directory is excluded from this target structure and should be removed after review.

- **`eggsplore-travel-planner/`** — project root
  - `architecture.md` — this updated guide
  - `README.md` — project overview and startup instructions
  - `package.json` **[restore]** — npm scripts and dependencies
  - `package-lock.json` — resolved npm dependencies
  - `tsconfig.json` **[restore]** — TypeScript settings and `@/*` alias
  - `postcss.config.*` **[restore]** — restore the actual filename from the working project
  - `next.config.mjs` — Next.js and allowed development origins
  - `tailwind.config.ts` — theme configuration
  - `.gitignore` — excludes private configuration and generated files
  - `.env.example` **[add A]** — safe environment placeholders
  - `requirements.txt` — proposed Python dependencies; no Python service implemented
  - **`public/`** — static images
    - `eggsplore-logo.png`
    - `home-background.png`
    - `home-mascot.png`
    - `bali.jpg` **[add A or update Home reference]**
    - `japan.jpg` **[add A or update Home reference]**
  - **`supabase/`** **[add A]** — version-controlled database setup
    - **`migrations/`**
      - `001_foundation.sql` — reconcile with the previously applied schema
      - Later numbered migrations **[planned B/C/D]** — module-specific schema and RLS
    - `verify-foundation.sql` — read-only schema inspection
  - **`src/`**
    - **`app/`** — routes, layouts and server endpoints
      - `layout.tsx` — A: root layout and AuthProvider
      - `page.tsx` — A: root redirect
      - `globals.css` — A: global styles
      - **`(auth)/`** — A: public authentication routes
        - **`login/`**
          - `page.tsx` — `/login`: email/password login and signup
      - **`(tabs)/`** — protected application routes
        - `layout.tsx` — A: auth guard and bottom navigation shell
        - **`home/`**
          - `page.tsx` — A: `/home`; B supplies real trip data
        - **`profile/`**
          - `page.tsx` — A: `/profile`, account and preference management
          - **`new/`**
            - `page.tsx` — A: `/profile/new`, create a travel preference profile
        - **`trips/`**
          - `page.tsx` — B: `/trips`, currently a placeholder
          - **`create/`** **[planned B]**
            - `page.tsx` — `/trips/create`, trip creation flow
          - **`[id]/`** **[planned B/D]**
            - **`voting/`** **[planned B]**
              - `page.tsx` — candidate pool and voting
            - **`itinerary/`** **[planned B, with C integration]**
              - `page.tsx` — itinerary draft/review and disruption proposals
            - **`budget/`** **[planned D]**
              - `page.tsx` — expense ledger and split UI
        - **`map/`**
          - `page.tsx` — C: `/map`, currently a placeholder
      - **`api/`** **[planned B/C/D]** — authenticated server handlers; proposed names
        - **`itinerary/`** **[planned B]**
          - `route.ts` — AI itinerary generation
        - **`assistant/`** **[planned C]**
          - `route.ts` — Ask AI
        - **`disruptions/`** **[planned C]**
          - `route.ts` — flight/weather integration
        - **`notifications/`** **[planned D]**
          - `route.ts` — notification operations
    - **`components/`** — A: shared component library
      - **`navigation/`**
        - `BottomNav.tsx`
      - **`ui/`**
        - `Button.tsx`
        - `Card.tsx`
        - `BottomSheet.tsx`
        - `index.ts`
    - **`features/`** — module logic and feature-specific components
      - **`auth/`** — A
        - `AuthProvider.tsx`
        - `useAuth.ts`
      - **`decision-engine/`** — B; currently empty
      - **`live-assistant/`** — C; currently empty
      - **`finances/`** — D; currently empty
    - **`lib/`** — shared integration helpers
      - `supabase.ts` — A: browser Supabase client
      - `utils.ts` — A: class-name merging
    - **`styles/`**
      - `theme.ts` — A: shared design tokens
    - **`types/`** **[planned shared contract]**
      - `profile.ts` — A/B: shared preference types and validation contract

All planned API paths are proposals, not existing implementations. If the team chooses a separate Python backend, document its directory and endpoints before adding it. Keep private `.env.local` on each developer's machine; exclude generated caches, dependency folders and build output from this tree and from Git.

## 1. Current application

Eggsplore is a Next.js App Router web application using TypeScript, React, Tailwind CSS and Supabase. It is currently a mobile-width web UI, not an Expo/React Native application.

The uploaded lockfile records Next.js 16.3.7, React/React DOM 19.3.0, Tailwind CSS 3, TypeScript 5, Supabase JS, Lucide icons, clsx and tailwind-merge. Its root Node requirement is >=22. Restore the actual `package.json` from the working local project: the ZIP does not include it, so scripts could not be inspected.

Authentication uses email/password. Google/Facebook/Apple OAuth, OTP login and MFA are not part of the current login UI. Email confirmation is an independent Supabase project setting; this ZIP does not establish whether it is enabled.

The browser calls Supabase with the signed-in user's session. Supabase RLS must enforce data access. The client-side navigation guard is a user experience feature, not a replacement for database authorization.

## 2. Inspection findings — resolve before teammate handoff

| Priority | Finding in this ZIP | Action |
|---|---|---|
| Required | `package.json`, `tsconfig.json`, and PostCSS configuration are absent | Copy the originals from the working project. Keep `package.json` and `package-lock.json` together; commit both. Do not replace them with a new unrelated project. |
| Required | No `supabase/` migration files were included | Save the previously applied Foundation SQL as a migration and add read-only verification SQL. Confirm it matches the deployed database. Do not rerun the create-once SQL on an existing schema. |
| Required | `src/app/tabs/` contains obsolete Home/Map pages and a separate layout | Remove this ordinary `tabs` directory after checking it contains no unique work. Keep `src/app/(tabs)/`. The ordinary directory creates `/tabs/home` and `/tabs/map`; its layout lacks the signed-in guard. |
| Required | Home's Create Trip button navigates to `/trips/create`, which does not exist | B implements `src/app/(tabs)/trips/create/page.tsx`. Until then, identify the feature as unfinished; clicking it will reach a missing route. |
| Required for images | Home references `/bali.jpg` and `/japan.jpg`, neither included in `public/` | Add these images with those exact names or change Home to use available images. |
| Required | No `.env.example` included | Add the two placeholder variables shown below. Share environment setup separately from source code. |
| Functional gap | Trips and Map pages contain headings and placeholder text | Assign their implementation to B and C respectively. Neither feature is finished. |
| Functional gap | Home trip cards are hardcoded previews with 2025 dates | B replaces these with actual accessible trips and calculates their status. A owns the Home layout. |
| Functional gap | Notification sheets are text; the settings switch stores a preference | D implements notification records and delivery. A integrates the bell and settings UI. |
| Functional gap | Profile history generation explicitly says “coming soon” | B implements it only after trip-history data exists. |
| Consistency | Profile displays three default travel profiles when `preferences.profiles` is missing, but the new-profile page appends to an empty saved array | A decides whether to persist templates or display an empty state. Currently the defaults may disappear when the first real profile is saved. |
| Network compatibility | Both profile pages use `crypto.randomUUID()` | Check profile creation on a LAN device: plain HTTP on a LAN address may lack this secure-context API. Use HTTPS or a tested UUID implementation before relying on LAN profile creation. |
| Collaboration | Profile updates replace the preferences JSON object/array | B and A must agree on a shared contract. Concurrent edits can overwrite each other; use an atomic database operation or normalized records when collaboration requires it. |
| Documentation | Old architecture says Next.js 14 and social login, with outdated palette values | Replace it with this document and align README setup instructions. |

An environment file and a generated TypeScript build cache were included in the upload. They must not be committed. No environment values are reproduced here.

No build/typecheck was run on this ZIP: required project configuration is missing. No live Supabase access or authenticated database authorization test was performed. The user reports that their complete local application runs and login works; that does not prove this incomplete archive is independently runnable.

## 3. Current routes and file ownership

Parenthesized route groups do not appear in the URL. Do not create a second `src/app/trips/page.tsx` alongside `src/app/(tabs)/trips/page.tsx`: both would resolve to `/trips`.

| Existing file | URL or purpose | Owner | Current behavior |
|---|---|---|---|
| `src/app/layout.tsx` | Root layout | A | Global CSS, metadata and AuthProvider |
| `src/app/page.tsx` | `/` | A | Redirects to login |
| `src/app/(auth)/login/page.tsx` | `/login` | A | Email/password signup and login, validation, loading/error UI |
| `src/app/(tabs)/layout.tsx` | Protected navigation shell | A | Waits for auth state; redirects signed-out users; mounts BottomNav |
| `src/app/(tabs)/home/page.tsx` | `/home` | A, with B data integration | Branded background/mascot, real Create Trip button, preview trips, quick links and placeholder sheets |
| `src/app/(tabs)/trips/page.tsx` | `/trips` | B | Placeholder |
| `src/app/(tabs)/map/page.tsx` | `/map` | C | Placeholder |
| `src/app/(tabs)/profile/page.tsx` | `/profile` | A | Loads own profile; edits name/avatar URL, password, preferences, emergency data and settings; logout |
| `src/app/(tabs)/profile/new/page.tsx` | `/profile/new` | A; B consumes saved data | Creates a travel preference profile with category, pace, companion, spending priority and interests |
| `src/features/auth/AuthProvider.tsx` | Session state | A | Initial session read, auth listener, cleanup and sign-out |
| `src/features/auth/useAuth.ts` | Auth context hook | A | Shared hook for user/session/loading/error |
| `src/lib/supabase.ts` | Supabase browser client | A | Reads public environment variables, rejects missing/placeholders, provides getSupabase |
| `src/lib/utils.ts` | Class-name helper | A | clsx plus Tailwind class merging |
| `src/components/navigation/BottomNav.tsx` | Home/Trip/Map/Profile navigation | A | Active route styles; hidden on `/profile/new`; Trip currently uses Compass |
| `src/components/ui/Button.tsx` | Shared button | A | Variants, sizes, loading/disabled state |
| `src/components/ui/Card.tsx` | Shared card | A | Reusable visual container |
| `src/components/ui/BottomSheet.tsx` | Shared modal sheet | A | Native dialog, backdrop/Escape handling and scroll lock |
| `src/components/ui/index.ts` | UI exports | A | Import primitives through `@/components/ui` |
| `src/styles/theme.ts` | Design tokens | A | Central palette, radii and shadows |
| `tailwind.config.ts` | Styling configuration | A | Exposes theme tokens as Tailwind utilities |
| `src/app/globals.css` | Global styles | A | Tailwind layers and global defaults |
| `next.config.mjs` | Next configuration | A | Allows development origin `192.168.191.1`; teammates use their own actual LAN host if needed |
| `public/eggsplore-logo.png` | Brand asset | A | Used by branded pages |
| `public/home-background.png` | Home background | A | Decorative hero image |
| `public/home-mascot.png` | Home mascot | A | Decorative hero character |
| `package-lock.json` | Exact dependency resolution | Shared; A coordinates | Present; package.json is missing from this ZIP |
| `requirements.txt` | Proposed Python dependencies | Future backend owner | No Python application code exists in this ZIP |
| `README.md` | Product overview | Shared | Distinguish proposed features from implemented behavior |

The `decision-engine`, `live-assistant` and `finances` feature directories are empty. They are ownership boundaries, not implemented modules. Empty directories alone will not be preserved by Git: add actual code or a short README when ready. Obsolete `src/app/tabs/` files should not be used by teammates.

## 4. Modules A–D

| Module | Responsibilities | Existing files to start from | Planned files — not present yet |
|---|---|---|---|
| **A — Foundation** | Supabase foundation schema/RLS, email/password auth, navigation shell, shared buttons/cards/bottom sheet, Home and account/profile UI | Auth, shared UI/nav/lib/styles, login/home/profile files above | `supabase/migrations/001_foundation.sql`, verification SQL, `.env.example`, shared data types |
| **B — Group Decision Engine** | Trip creation and invitations, selecting saved preference profiles, candidate pool, voting, AI itinerary generation and draft review | Trips placeholder; reads data saved by Profile | `src/features/decision-engine/`, `(tabs)/trips/create/page.tsx`, `(tabs)/trips/[id]/voting/page.tsx`, `(tabs)/trips/[id]/itinerary/page.tsx`, server itinerary endpoint |
| **C — Live AI Assistant** | Interactive map, pins/routes/place details, Ask AI, flight/weather disruption detection and suggested itinerary changes | Map placeholder | `src/features/live-assistant/`, authenticated server AI/disruption endpoints, map provider integration |
| **D — Money & Logistics** | Budget tracker, expense entry, equal/custom split calculations, price estimates, notification records/delivery | Foundation expense table once schema is checked; Profile notification preference | `src/features/finances/`, `(tabs)/trips/[id]/budget/page.tsx`, notification service/endpoints and migrations |

**Map belongs to C.** D can use C's selected place identifiers, coordinates and travel distance/time results for transport estimates or location-linked expenses. D does not need to implement a second map. Place details and routing come from the agreed map provider; money calculations remain in D.

**Preference Profile boundary:** A owns the personal profile forms already implemented. B owns using those profiles in a trip and aggregating group preferences for candidates, voting and generation. Agree on shared types before either module changes the JSON shape.

**Itinerary boundary:** B owns initial generation, draft approval and itinerary storage. C reads the saved itinerary and proposes disruption changes. Changes should require the agreed approval flow rather than silently overwriting B's data. D supplies budget constraints and estimates.

**Notification boundary:** C detects a disruption; B/D can emit their own events; D owns storage/delivery and respects notification settings. A supplies the bell and settings UI. Avoid two teams implementing separate inboxes.

## 5. Current profile data contract

`public.profiles.id` corresponds to the Supabase auth user ID. The UI reads and updates `display_name`, `avatar_url`, `preferences` and `emergency_contact`. Avatar editing currently accepts a URL; it is not a file-upload feature.

The advanced form currently saves:

```ts
type SavedTravelProfile = {
  id: string;
  name: string;
  emoji: string;
  category: string;
  tags: string[];
  pace: string;
  companion: string;
  spendingOrder: string[];
  interests: string[];
  createdAt: string;
};
```

`preferences.profiles` holds an array of these objects. Legacy/default entries can contain only id/name/emoji/tags, so B must handle missing advanced fields. Profile quick-edit preserves existing extra fields through object spreading. The first three interests become display tags; the full interest list is stored separately.

`preferences.settings` currently contains notifications (boolean) and units (`metric` or `imperial`). These are stored choices, not proof that notifications or unit conversion are implemented. Emergency data stores contact and destination-note fields; keep it private to the profile owner.

Move shared interfaces and validation into a agreed file such as `src/types/profile.ts` before extending them. Treat this path as planned; it does not exist yet. Do not copy private emergency information into prompts or group member directories.

## 6. Database contract and remaining schema work

The Foundation SQL previously shared in the project discussion defines `profiles`, `trips`, `trip_members`, `expenses` and `itinerary_items`. It includes profile creation/backfill, owner membership creation, timestamp triggers and RLS helper functions/policies. That SQL is absent from this archive; its deployment was not verified during this inspection.

The intended Foundation permissions are: users access their own private profiles; trip members read trip data; trip owners manage membership, expenses and itinerary items. This initial expense model is owner-managed. D must explicitly extend it if members need to add their own expenses.

Before marking A complete, inspect the deployed schema and test with two different authenticated accounts. Saving preferences on one account is not a cross-user access test.

B needs reviewed migrations for invitations, trip preference selection, candidates, votes and itinerary generation state. C needs a persistence decision for chat/disruption events. D needs budgets, expense splits/shares, currency information, estimates and notifications. Do not claim the five Foundation tables already cover these features.

All new tables need constraints, indexes and RLS. Keep numbered migrations under `supabase/migrations/`; coordinate their order. Do not edit an already applied migration as a substitute for a new migration, and do not drop existing tables to resolve a conflict.

AI, flight/weather and privileged provider credentials belong in server-only environment variables and authenticated server handlers. Never put a service-role/secret key in browser code or a `NEXT_PUBLIC_` variable. Validate user identity and trip authorization at server endpoints.

## 7. Shared design rules

Reuse `@/components/ui` for base buttons, cards and sheets. Keep feature-specific components in their module directory. The layout's content width is 390px maximum; avoid mounting a second BottomNav within a page.

Current theme values include primary.600 `#7E49C2`, surface.background `#FBF9FF`, surface.card `#FFFFFF`, surface.border `#D8C1F0`, text.primary `#3D174F`, status.live `#10B981`, and status.delay `#F59E0B`. Several page-specific styles are currently hardcoded; do not claim all pages already use tokens exclusively.

## 8. Teammate installation and run instructions

First restore the missing root configuration and database migration files from the complete working project. The archive alone is not a runnable handoff.

1. Install Git and a maintained Node.js version satisfying the project engine (>=22), including npm. Use the same Node major across the team.
2. Clone the repository and enter its root folder.
3. Run `npm ci`. It installs the JavaScript/TypeScript dependencies from package.json and package-lock.json; teammates do not individually download Supabase JS, React or icons. A mismatch between the manifest and lockfile must be resolved by the contributor who changed dependencies.
4. Add `.env.example` to source control with these placeholders:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

5. Each teammate copies it to `.env.local` and supplies the team's agreed Supabase project values. Never use a service-role key here. In PowerShell:

```powershell
Copy-Item .env.example .env.local
```

6. The database owner applies migrations to a new project once or reconciles the existing project. Each teammate does not rerun the create-once schema on the same shared database. Enable the email/password provider and document the chosen email confirmation behavior.
7. Run the scripts from the restored package.json. Expected project commands are `npm run dev`, `npm run build`, `npm run start`, and `npm run typecheck` if defined. This archive does not contain the script definitions; verify them before publishing setup instructions. If typecheck is missing, add `"typecheck": "tsc --noEmit"` to scripts.
8. Test signup/login, reload persistence, logout and Profile saving. For LAN development, use `npm run dev -- --hostname 0.0.0.0` and set allowedDevOrigins to the host actually used. Also test new profile creation on the LAN device.

**Python:** `requirements.txt` lists supabase, google-genai and python-dotenv, but there is no Python backend in the uploaded source. Python/pip is not required to run the current Next.js UI. If B/C later choose Python, they must add runnable service code, a documented Python version, configuration, dependency resolution and startup instructions. If they choose Next.js server endpoints instead, add the selected JavaScript AI SDK through npm. Do not install both stacks without deciding the backend design.

## 9. Foundation completion checklist

- [ ] Restore package.json, tsconfig.json and PostCSS config to the handoff.
- [ ] Add .env.example and the actual Foundation migrations/verification SQL.
- [ ] Remove obsolete src/app/tabs pages after reviewing them.
- [ ] Add missing Home trip images or replace their references.
- [ ] Agree whether default preference profiles are templates or persisted records.
- [ ] Check profile IDs work on the intended LAN/HTTPS environment.
- [ ] Confirm email/password login/signup, session reload and logout.
- [ ] Confirm profile edits/new preferences persist after reload.
- [ ] Confirm password change works with the configured Supabase policy.
- [ ] Test RLS with owner, member and unrelated authenticated accounts.
- [ ] Run a clean installation, TypeScript check and production build from the committed repository.
- [ ] Clearly mark Trips, Map, AI, notifications and Create Trip as pending until implemented.
- [ ] Ensure no private environment files or generated files are staged.

## 10. Push to GitHub — Windows PowerShell

Use your complete working project, not the incomplete ZIP. Replace paths and YOUR_USERNAME below with your own values.

### Step 1: Open the project terminal

```powershell
cd "C:\Users\user\Downloads\eggsplore-travel-planner"
git --version
git status
git remote -v
git branch --show-current
```

If `git status` says it is not a Git repository, initialize it:

```powershell
git init -b main
```

If it already is a repository, keep the existing history and check its remote before making changes.

### Step 2: Add this guide and restore missing handoff files

Save this document as `architecture.md` at the root. Remove the older misspelled `archiutecture.md` after review. Restore the original configuration files, add .env.example and migrations, and resolve the findings above.

Ensure .gitignore includes:

```gitignore
node_modules/
.next/
out/
.env
.env.*
!.env.example
*.tsbuildinfo
```

Keep existing ignore rules as well. Check whether a private environment file is already tracked:

```powershell
git ls-files -- .env .env.local
```

If `.env.local` is listed, untrack it while keeping the local copy:

```powershell
git rm --cached -- .env.local
```

Do the same only for other actual tracked private environment files. If a server secret was already pushed, revoke/rotate it; ignoring the file does not remove past commits.

### Step 3: Validate and review what will be uploaded

After restoring the real package.json:

```powershell
npm ci
npm run typecheck
npm run build
git add .
git diff --cached --stat
git diff --cached --name-only
git diff --cached
```

Use the project's actual scripts if their names differ. Review locally; do not paste secret values into chats. The staged list should contain source/assets/configuration/docs and the lockfile, not .env.local, node_modules, .next or tsbuildinfo.

### Step 4: Commit

```powershell
git commit -m "docs: document architecture and module handoff"
```

If this is the first commit and also includes the application, use a message such as `feat: add Eggsplore foundation and team guide`. If Git asks for author details, configure your own name and GitHub email locally:

```powershell
git config user.name "Your Name"
git config user.email "YOUR_GITHUB_EMAIL"
```

Then retry the commit.

### Step 5: Create an empty GitHub repository

Open https://github.com/new, choose the repository name and visibility, and create it without an initial README, .gitignore or license. You already have local content.

For a project with no existing origin:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/eggsplore-travel-planner.git
```

If origin already exists, inspect it and use it only if it is the intended repository. Do not blindly add another origin or overwrite a teammate's remote.

### Step 6: Push

For a new repository with the local branch named main:

```powershell
git push -u origin main
```

Complete the GitHub authentication prompt if shown. If your branch has a different name, substitute the branch name. If a push is rejected because remote commits already exist, stop and inspect them; do not force-push to bypass the error.

### Step 7: Confirm and invite teammates

Refresh the GitHub repository. Confirm source files, package.json, lockfile and architecture.md are present, and private environment files are absent. Add teammates through repository settings with the agreed access level.

For future module work, use a feature branch and a pull request:

```powershell
git switch -c feature/module-b-trip-creation
# Make and validate the changes.
git add .
git commit -m "feat(decision-engine): add trip creation"
git push -u origin feature/module-b-trip-creation
```

Open a pull request on GitHub. Coordinate changes to shared UI, schema, types and package dependencies with their owners. Avoid rewriting teammates' history.

## References

- Next.js route groups: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- Reproducible npm installation: https://docs.npmjs.com/cli/v11/commands/npm-ci/
- GitHub push instructions: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
