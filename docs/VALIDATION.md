# Migration Validation

Recorded 2026-10-02. Tests used the migrated source, not the previous Next.js app.

## Passed

- TypeScript: `npm run typecheck`.
- Unit suite: `npm test`; five assertions groups cover real calendar dates,
  chronological trip validation, inclusive status boundaries, device-local date
  formatting and Supabase plain-object error messages.
- Expo dependency alignment: `npx expo install --check`.
- NativeWind uses class-based dark mode for Expo web color-scheme compatibility.
- JavaScript/assets export for Android, iOS and web: `npm run build`.
- Chromium UI smoke tests against a mocked Supabase endpoint: signup mismatch
  rejection and email-confirmation message, failed/successful login, restored
  session on reload, account name update, wrong-current-password rejection,
  password update flow, persisted units/notification preference, trip creation
  and listing, preference create/edit/delete and spending reorder, preservation
  of unrelated preference JSON, emergency contact saving, logout and protected
  routes after logout.
- Browser width check at 320px and screenshot inspection at 390px and 1280px.
  Screenshot checks are of Expo web, not an Android/iOS simulator. Emoji font
  availability differs across browser environments and actual devices.
- SHA-256 comparison: all three supplied PNG assets and the foundation SQL
  migration are unchanged from the original upload.
- Active source scan: no Next.js imports, HTML form elements or browser storage
  APIs remain in app source.

The browser harness used fake credentials and intercepted all Supabase calls.
It verifies client behavior, not actual database permissions or provider setup.

## Incomplete / not run

- Expo Doctor: 19 of 21 checks passed. The config-schema and React Native
  Directory metadata checks could not finish because remote requests failed
  (DNS/network response errors). Run `npx expo-doctor` on your machine.
- Real Supabase signup/login, confirmation delivery, deployed schema and RLS.
  No credentials were configured and no live tables were changed.
- Android/iOS device execution, native keyboard behavior, safe areas, Android
  hardware Back, device session lifecycle and native accessibility.
- EAS cloud builds, APK/IPA installation, signing and store distribution.
- Mapbox, AI calls, push delivery and B/C/D integrations, which remain planned.

Exporting native bundles does not prove a native build or a real-device test
passed. Complete the acceptance checklist in architecture.md with your team.
