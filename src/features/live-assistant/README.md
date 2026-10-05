# Module C: Live AI Assistant

## Milestone 1 implementation

- MapScreen: fixed map layout with the existing theme and shared Heading.
- components/TripMap.native.tsx: runtime guard for Expo Go, public-token setup,
  and a render error boundary. Native Mapbox is loaded only on a supported path.
- components/NativeTripMap.tsx: native Mapbox map, three tappable Lucide pins,
  loading/error feedback, retry, reset-to-Osaka control, and alternative place list.
- components/TripMap.tsx: browser/default place preview; no native map imports.
- components/MapFallback.tsx and PlaceList.tsx: selectable sample-place preview.
- components/PlaceDetailsSheet.tsx: shared BottomSheet with place information,
  tags and Ask AI button. The button explains that AI is not connected yet.
- data/samplePlaces.ts: labelled sample Osaka fixtures, approximate coordinates.
- types.ts: proposed PlaceRef contract plus local sample-place and map props.

Native map coordinates use [longitude, latitude]. Fixtures are not Mapbox search
results or Supabase itinerary rows. No trip selection, GPS, live opening hours,
crowd estimates, Vibe Layer filtering, AI, weather, flight calls or database writes
are implemented yet. Tags displayed on a place are informational, not filters.

## Setup

Install `@rnmapbox/maps@10.3.6` with `npx expo install`, commit package.json and
package-lock.json, and add `@rnmapbox/maps` to app.json's expo.plugins. Set
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to a public pk. token. Never put secrets in public
environment variables. See the patch's INSTALL.md for steps and acceptance checks.

Mapbox requires a custom development build. Expo Go and web can preview the place
sheet through the sample list. The native dependency must still be installed for
Metro resolution, even when testing the preview. Keep both TripMap variants.

Reuse the existing map route. Shared UI components and eas.json are unchanged.
The fixed map layout deliberately avoids nesting the map in Screen's ScrollView.
All added icons come from lucide-react-native.

## Future ownership and integration

Agree the shared PlaceRef IDs and fields with B/D before wiring real trip data.
C owns the map and selection; B consumes places for candidates/itinerary stops,
and D consumes coordinates and future transport estimates. Share one map.

Future Gemini/AviationStack calls belong in authenticated Supabase Edge Functions.
Check JWT and trip membership/ownership server-side, validate returned actions,
and require owner review before applying itinerary changes. No backend is needed
for this sample-place milestone. Do not weaken existing profile/trip RLS.

Weather and manual disruption review remain future work. Automatic background
flight monitoring is stretch work.

