# Next.js to React Native Migration

The original uploaded source was inspected, not inferred from the screenshots.
This conversion retains supplied PNG assets and the initial Supabase SQL while
rebuilding browser screens with native primitives. It does not use a WebView.

## Old-to-new mapping

| Old file | New file |
| --- | --- |
| src/app/layout.tsx | src/app/_layout.tsx |
| src/app/page.tsx | src/app/index.tsx |
| src/app/(auth)/login/page.tsx | src/app/login.tsx + features/auth/LoginScreen.tsx |
| src/app/(tabs)/layout.tsx | src/app/(tabs)/_layout.tsx |
| src/app/(tabs)/home/page.tsx | src/app/(tabs)/home.tsx + features/home/HomeScreen.tsx |
| src/app/(tabs)/profile/page.tsx | src/app/(tabs)/profile.tsx + features/profile/ProfileScreen.tsx |
| src/app/(tabs)/profile/new/page.tsx | src/app/profile/new.tsx + features/profile/PreferenceScreen.tsx |
| src/app/(tabs)/trips/page.tsx | src/app/(tabs)/trips.tsx + features/trips/TripsScreen.tsx |
| src/app/(tabs)/map/page.tsx | src/app/(tabs)/map.tsx + features/live-assistant/MapScreen.tsx |
| components/navigation/BottomNav.tsx | Expo Router Tabs in the tabs layout |
| public/*.png | assets/*.png with bundled require() references |
| NEXT_PUBLIC_SUPABASE_* | EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY |
| Browser Supabase persistence | React Native AsyncStorage + foreground token refresh |
| HTML form/input/button | Native TextInput/Pressable and explicit validation |
| HTML bottom sheet | Native Modal with keyboard avoidance and Android back support |
| Browser drag/drop spending priorities | Accessible native up/down reorder buttons |
| Web UUID API | expo-crypto randomUUID() |

Remove obsolete next.config.*, next-env.d.ts, .next, postcss.config.mjs, web
globals.css, old Tailwind configuration, web theme tokens, requirements.txt and
the old src/app/tabs routes when applying this to an existing git checkout.
The delivered fresh folder already omits these. Do not carry forward Next.js
page.tsx files alongside the Expo routes.

## Intentional behavior changes

- Real device status bar replaces the fake 9:41/battery graphics.
- Native layouts adapt to safe areas and keyboards instead of a fixed phone frame.
- Social/OTP/MFA UI remains absent, matching the chosen email/password flow.
- Real trips replace static dated sample trips and references to missing photos.
- Create Trip now has a working database-backed destination rather than a dead link.
- Preference profiles are actual saved data, not fallback demo cards.
- Preference editing supports the full form and preserves additional stored keys.
- Profile JSON writes detect concurrent changes with updated_at.
- Password changes check the current password by reauthenticating first.
- Original logo, background and mascot are copied byte-for-byte.
- Theme remains the existing Eggsplore branding; no claim of pixel-identical native rendering.

## Not implemented by this migration

Mapbox, AI itinerary generation, candidates/votes, Ask AI, weather/flight calls,
budget screens, split logic, push delivery and booking integrations were absent
from the source. Their planned ownership is documented rather than hidden behind
fake working buttons. No secret keys, cloud build, new Supabase project or live
database modification is included.

The original README is retained under docs/PROJECT-PROPOSAL.md to preserve the
team's pitch, external presentation links and history. Its image references were
already missing from the uploaded archive, and its original run commands are
historical; follow the new root README instead.
