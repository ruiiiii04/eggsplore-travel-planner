# Get more ideas: group preferences

Apply supabase/migrations/014_group_candidate_preferences.sql after migrations 001 through 013. Then deploy the updated Edge Function:

```powershell
supabase functions deploy generate-candidates
```

Use the same Supabase project as the app. Keep the existing server-side GEMINI_API_KEY and GEMINI_MODEL secrets. No public Gemini key or extra app dependency is required. The migration and function deployment have not been applied automatically.

The function receives a trip ID, authenticates through Supabase's user-scoped REST API, and reads the trip's current destination plus saved travel profiles for the leader and every joined member. Each person contributes equal weight, irrespective of number of saved profiles. Profiles are combined within each member, deduplicating interests; the AI receives anonymous interests, travel pace, companions and spending priorities. Names, email, emergency contacts, account settings and private candidate pools are not read or sent to Gemini.

Updates to saved profiles and trip membership take effect on the next Get more ideas request. Members without saved profiles are counted in coverage but contribute no fabricated preferences. When nobody has profiles, the function explicitly uses a varied destination mix. Suggestions are advisory, are shared in the candidate pool, and still require group votes and draft selection.

The result shows the number of members whose saved preferences contributed. Test two accounts with different saved profiles, joined to the same trip, then generate ideas from either account. Unjoined invitees are not included until added as trip members.
