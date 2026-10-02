# Module B: Group Decision Engine (planned)

Use features/profile/types.ts and profiles.preferences.profiles as the existing
preference contract. Reuse features/trips for trip identity. Candidate and voting
tables, normalized weights and AI Edge Functions do not exist yet.

Add feature screens here and thin routes under src/app. Agree candidate/vote RLS
with A, shared place coordinates with C, and budget constraints with D. Keep
Gemini secrets server-side and require leader review before publishing an AI
itinerary. Add migrations instead of editing a migration already run by the team.
