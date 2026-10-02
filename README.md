# Eggsplore by Purple Feelings

Team: Yii Aik Lui, Anson Wong Leon Sheng, Lee Zhi Wei, Tan Zhi Shing.

Eggsplore is now a React Native app built with Expo, Expo Router, TypeScript,
NativeWind, and Supabase. It targets Android and iOS, with an optional Expo web
preview. It does not use Next.js, a WebView wrapper, or HTML screens.

## Start here

Read [docs/START-HERE.md](docs/START-HERE.md) for Windows setup and phone testing.
Read [architecture.md](architecture.md) for the file tree, module ownership, data
contracts, and remaining work. The original product pitch is retained in
[docs/PROJECT-PROPOSAL.md](docs/PROJECT-PROPOSAL.md) as a historical document, not
an implementation checklist. Some capabilities described there remain planned.

## Run

Use Node.js 22 LTS (22.13 or later) or Node.js 24 LTS (24.3 or later).

```powershell
npm ci
Copy-Item .env.example .env
# Enter your existing Supabase URL and public key in .env.
npm run typecheck
npm test
npm start -- --go
```

Scan the QR code with a compatible Expo Go version. Keep the computer and phone
on the same Wi-Fi. The `--go` option selects Expo Go even though the project also
includes development-client support. `npm run web` provides a browser preview.

## Environment

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

These are public client credentials; database access is protected by RLS. Never
put a Supabase secret/service-role key, Gemini key, or AviationStack secret in
the app. Do not commit `.env`. Restart Expo after changing environment values.

Keep your current Supabase project and existing users. Do not rerun the initial
SQL migration against tables that already exist. A new project needs
`supabase/migrations/001_foundation.sql` once, then the read-only verification
queries. No new database migration is required by this Expo conversion.

## Current scope

| Feature | Status |
| --- | --- |
| Email/password signup, login, logout, persistent session, protected routes | Implemented; requires your Supabase configuration |
| Home, logo, background, mascot, real OS status bar, four-tab navigation | Migrated to native components |
| Account editing, password change, emergency contact, destination notes, settings | Migrated |
| Preference profiles: create, edit, delete, categories, pace, companions, spending order, interests | Migrated; existing JSON format preserved |
| Trip creation, trip list, date filters, basic trip detail | Implemented to replace the old dead Create Trip link |
| Candidate pool, voting, AI itinerary generation | Planned: Module B |
| Native Mapbox, Ask AI, weather/flight disruptions | Planned: Module C; map currently shows a placeholder |
| Budget, split logic, price estimates, notification delivery | Planned: Module D |

Google/Facebook/Apple sign-in, magic links, and MFA flows are not included.
Supabase email confirmation may still be enabled for signup; that is separate
from two-factor authentication. The saved notification toggle does not register
a push token or send notifications yet.

## Dependency management

`package.json` and `package-lock.json` are the source of truth. Every teammate
runs `npm ci`; do not send `node_modules`. Use `npx expo install <package>` for
native dependencies so their versions match the Expo SDK. Commit both package
files whenever dependencies change.

This release uses Expo SDK 57, React Native 0.86, React 19.2, and NativeWind 4.
There is no Python backend in the uploaded project, so `requirements.txt` is not
part of the mobile setup. Future Gemini and flight calls belong in authenticated
Supabase Edge Functions with server-side secrets.

## Build and test

```powershell
npm run typecheck
npm test
npx expo install --check
npx expo-doctor
npm run build
```

`npm run build` exports JavaScript/assets for Android, iOS, and web. It does NOT
produce an APK or IPA. See START-HERE for EAS build instructions and the device
acceptance checklist. Bundling is not a substitute for testing on a real phone.

Native Mapbox needs a custom development build; it does not run in Expo Go.
Remote push notifications also need their own native setup and testing. Install
these integrations when their owning module is implemented, not just to make
the dependency list look complete.

## References

- [Expo Router installation](https://docs.expo.dev/router/installation/)
- [Expo SDK compatibility](https://docs.expo.dev/versions/latest/)
- [Supabase native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [NativeWind installation](https://www.nativewind.dev/docs/getting-started/installation)
- [Native Mapbox installation](https://rnmapbox.github.io/docs/install)
