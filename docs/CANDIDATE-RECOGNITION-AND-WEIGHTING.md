# Candidate recognition, destination starters and weighted voting

Apply `supabase/migrations/018_preference_weighted_votes.sql` after migration 017, then deploy:

```sh
supabase functions deploy candidate-autofill
supabase functions deploy generate-candidates
```

Both functions require GEMINI_API_KEY and GEMINI_MODEL in Supabase secrets. Keys stay on the server.

Empty destination pools automatically request six destination-specific starter places using the existing authorized generate-candidates service. There is no finite destination whitelist for generation. Curated Tokyo, Kyoto, Osaka and Bali defaults remain immediately available. Other destinations require network access and configured Gemini; failures show an error and the Get AI Ideas button can retry. Country names such as Japan no longer silently seed Tokyo.

Link import resolves up to five redirects and reads public page titles/descriptions and TikTok oEmbed captions. Supported hosts are explicitly listed in link-context.ts, and each redirect is checked before fetching. Fetches have a total 12-second timeout and a 512 KB body limit. HTTPS only; no arbitrary hosts, login cookies or private posts. Caption metadata must identify a single place and location; AI must return empty fields when uncertain. A post behind login, bot protection, or an unavailable caption still requires manual details. This does not analyze the actual video or bypass platform access restrictions.

Preference profiles now support optional category weights from 0 to 100. Blank profiles derive category weights from their saved tags, interests and template. Explicit weights are normalized; zero disables a category. Each profile contributes a normalized distribution and distributions are averaged per member. Duplicating a profile does not multiply influence.

For a candidate, matching preference mass is the sum of the member's normalized weights for distinct candidate categories. Vote strength is 1 + matching mass (1 to 2). The preference score sums signed strengths: likes positive, dislikes negative. Members without usable preferences and candidates without matching tags use strength 1. Abstentions contribute zero. Raw counts and percentages remain unweighted. Candidate cards and confirmed draft choices rank by preference score; leaders retain explicit selection and editing controls.

The snapshot RPC includes only user IDs already present in group votes and sanitized travel preference fields, never profile names, email, settings, notes or emergency contacts. Current preferences are returned even when pool content revision is unchanged. Computed scores stay in memory and are stripped before persistence to avoid duplicated counts or stale ranking.
