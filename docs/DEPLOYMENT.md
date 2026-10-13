# Eggsplore deployment plan

This project is a React Native + Expo app backed by Supabase. For a judge/demo
release, build an Android APK with EAS and publish that APK as a GitHub Release
asset. The release asset URL is the direct download link to put in the README or
submission form. Use an Android App Bundle (AAB) for Google Play later; use
TestFlight for iOS.

## Current readiness

- `eas.json` already has a `preview` profile that produces an installable APK.
- `app.json` does not yet declare `expo.android.package` or an EAS `projectId`.
- The project needs an Expo account/project before cloud builds can run.
- The repository README still has an Android download placeholder; replace it
  after attaching the APK to a GitHub Release.
- The app needs a reachable Supabase project with its schema and Edge Functions
  deployed. The Gemini API key belongs in Supabase Edge Function secrets, never
  in the Expo app.

## Recommended Android demo release

### 1. Prepare Supabase

Use the existing Supabase project if it contains the team's data. Check that the
required tables, Row Level Security policies, Auth settings, and Edge Functions
are present. Do not rerun the foundation migration against a database that
already has the schema.

Set `GEMINI_API_KEY` in Supabase Dashboard → Edge Functions → Secrets, then
deploy the functions required by the app with the Supabase CLI. Keep all
provider/service-role secrets server-side. The app only needs the Supabase URL
and publishable (or legacy anon) key; RLS must protect every user-data table.

### 2. Link this app to EAS

Install/use the EAS CLI and sign in with the team's Expo account:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

During setup, select the correct Expo owner and choose a permanent, globally
unique Android application ID (reverse-domain form, such as
`com.<team>.eggsplore`). Once confirmed, commit the generated `android.package`
and EAS `projectId` in app configuration. Do not change this package ID after
publishing installs, because Android treats a different ID as a separate app.

### 3. Add the public app environment values

In the Expo dashboard, add these variables to the EAS environment used by the
build (typically `preview`):

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

These values are included in the client app and are not secrets. Never add a
Supabase service-role key, Gemini key, or AviationStack key as an
`EXPO_PUBLIC_*` variable. Keep those secrets in Supabase Edge Function secrets.
Confirm the Expo config reads the same variable names before starting the build.

### 4. Build and install the APK

From the project root:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

When the build finishes, open its EAS build page and install the APK on a real
Android phone. Verify sign-in, trip creation, itinerary/voting, expenses, map,
and the demo disruption flow against the deployed Supabase project. A cloud APK
build consumes EAS build quota.

### 5. Publish a direct download link

Download the completed APK from EAS. Create a GitHub Release for the tested
version and attach the APK as a release asset. Copy the asset's **Download** URL
into the `Android download` link in `README.md` and the submission form. Keep the
release asset public if judges should be able to download without signing in.
Do not commit the APK into the source tree.

## Store releases

- **Google Play:** retain the same Android package ID; build with
  `npx eas-cli@latest build --platform android --profile production` to produce
  a store-ready AAB, then submit through EAS Submit or Play Console. Store
  listing, privacy/data-safety details, screenshots, and Play testing/review are
  separate release tasks.
- **iOS:** configure the iOS bundle identifier and Apple signing through EAS,
  then build and submit to TestFlight. Public App Store release requires the
  App Store Connect listing and Apple's review. TestFlight requires an Apple
  Developer account.
- **Web demo (optional):** the app has Expo web output configured. A hosted web
  build is a separate target and does not replace the Android APK requirement;
  verify native-only modules and map behavior in web before publishing it.

## Release checks

- Test the exact release build on a physical Android device.
- Confirm Supabase Auth redirect/deep-link behavior with the app's `eggsplore`
  scheme and the production Supabase URL.
- Confirm RLS is enabled and test with a second account so trip/private data is
  not exposed across users.
- Ensure no `.env`, signing credentials, provider secrets, or service-role keys
  are staged or attached to the release.
- Keep the GitHub Release's version, README download link, and submission link
  aligned when uploading a replacement APK.
