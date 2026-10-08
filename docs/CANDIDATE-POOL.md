# Candidate Pool, Add Candidate and Review Draft

## Run

From the project folder:

```powershell
npm install
npm run typecheck
npm test
npx expo start --clear
```

Keep your existing Supabase environment configuration. If starting fresh, copy `.env.example` to `.env` and fill in your public Supabase URL and anon key. Sign in, open a trip, and select **Vote**.

## Included

- Candidate Pool integrated into the existing trip workspace, preserving the existing header, navigation, colours, local Fredoka/Inter fonts, two-column cards and purple/lavender styling.
- Add Candidate as a full-screen form with AI import panel, photo selection, pasted links, manual name/location fields, up to three tags (including custom tags), Clear and Submit for Voting.
- Like/dislike toggles, accurate vote percentages, All/Shortlist/Voted counts, popularity/name/newest sorting, candidate details, shortlisting and removal.
- Tokyo, Osaka, Kyoto and Bali starter places. Unsupported destinations start empty rather than showing unrelated places. Starter candidates have zero votes; no fabricated group votes or live crowd estimates.
- Review Draft timeline with trip dates, day badges, top-vote highlight, editable activity names/locations/times/day assignment, insertion and removal. Drag the handle vertically to move one position; tap it for accessible Move up/down controls.
- Candidates, attached photo data, source links, drafts and votes saved per signed-in user and trip in Supabase profiles.preferences.candidatePoolsV1. Existing device-local pools migrate on first open when no account pool exists. Submission waits for the server save; failed saves keep the form open. Requires an internet connection to load or change the pool. No additional database migration is needed with the foundation profile schema. Reopening Review Draft preserves manual edits; Rebuild explicitly discards them and ranks current votes again.
- Organiser-only publication with a single database transaction. Published activities display grouped by day in the existing itinerary screen.

## Enable publication

Run `supabase/migrations/002_publish_candidate_draft.sql` in the Supabase SQL editor **after** the existing `001_foundation.sql` migration. Do not rerun the foundation migration in an existing database. The new RPC checks trip ownership, locks the trip row and atomically replaces the existing itinerary. Failed publication leaves the draft available for retry. Publication is not deployed automatically by this ZIP.

## Enable optional AI auto-fill

The included `supabase/functions/candidate-autofill/index.ts` runs server-side and requires an authenticated user. Deploy with your Supabase CLI:

```powershell
supabase functions deploy candidate-autofill
supabase secrets set GEMINI_API_KEY=YOUR_KEY GEMINI_MODEL=YOUR_AVAILABLE_MODEL_ID
```

Choose an available Gemini Flash model in your account; no model is hard-coded. Never put the Gemini secret in Expo public environment variables. Without the function or configuration, the form reports AI unavailability and still supports manual entry. Photos are sent to the configured model when the user chooses Photo. Link extraction only uses information visible in the URL; it does not scrape TikTok/Instagram or resolve shortened links. Users can review and correct extracted fields before submitting.

## Current boundaries

- Candidate/vote collaboration across devices is **not implemented**. Pools are private to each user and trip in Supabase; votes from different users are not combined. Publishing the final itinerary uses the existing shared Supabase database. A shared candidate/vote schema with membership policies and Realtime is still required for genuine group voting.
- Draft generation is a deterministic vote-ranked starter with up to four places per day, not Gemini itinerary generation. It does not optimise transit, opening hours, budget, weather or booking availability.
- Default candidate photos reuse existing project cover assets; they are decorative, not verified photos of every named attraction.
- Days are limited to 30 in the draft editor. Published timestamps encode the trip's displayed day/time in UTC because the existing schema has no destination timezone. The itinerary UI preserves the entered wall-clock time from the description. Add destination timezone support before using these timestamps for reminders or external calendars.
- New selected photos are saved as inline base64 data with the account pool (under 4 MB). Previously saved temporary photo URIs cannot be recovered if the source file expired; reattach those photos. A dedicated Supabase Storage bucket is preferable for large collections.
- The two reference Candidate Pool screenshots differ. The existing project's header/card sizing was retained; the Add Candidate and Review Draft references guided the new full-screen layouts. The pink device mockup frame and fake status bar are not application UI.

## Validation performed

TypeScript compile, browser-target component bundle, candidate model assertions, and repository test command. Automated visual/browser inspection was blocked by the browser runtime download failing in the build environment. Physical iOS/Android testing and live Supabase/Gemini integration testing remain necessary after configuration.

## Changed files

- `src/features/decision-engine/CandidatePool.tsx`
- `src/features/decision-engine/model.ts`
- `src/features/trips/TripWorkspace.tsx`
- `tests/candidates.test.ts`
- `supabase/migrations/002_publish_candidate_draft.sql`
- `supabase/functions/candidate-autofill/index.ts`
- `package.json` and `package-lock.json` (Expo-compatible image picker)
