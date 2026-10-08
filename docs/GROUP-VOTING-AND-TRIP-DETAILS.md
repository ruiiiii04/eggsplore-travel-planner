# Trip details and shared group voting

Date fields in Create Trip open a slide-up month calendar with selection, confirmation and clearing. Return dates before departure are disabled. A later departure clears an earlier return date. Budget supports dragging either handle, numeric minimum/maximum entry and presets, from RM 1,000 to RM 10,000 in RM 100 steps.

All, Voted, Unvoted and In Draft use group-wide data. Voted means at least one group member has voted (either direction); Unvoted means no group votes. Each member's selected like/dislike button still represents their own vote. In Draft is the shared candidate selection. Votes no longer discard manual draft edits.

The trip header, member list and Candidate Pool show Group Leader or Member. Everyone can vote, add places and edit/view the shared review draft. Only the leader can publish; existing publication RPCs enforce ownership, and migration 012 additionally protects published pool status.

## Database setup

Apply only pending migrations in numeric order. With migrations 001 through 011 already installed, run supabase/migrations/012_candidate_group_sync.sql in your Supabase SQL editor. Do not rerun the foundation migration. Migration 006 must already exist for shared candidate tables and save RPCs. The app requires the new read_trip_candidate_snapshot RPC from 012. This migration has not been applied to your live database automatically.

Realtime refreshes group changes, including on reconnect; a 10-second refresh and app foreground refresh recover missed events. Both candidate content and all member votes are read from one consistent database snapshot. Shared data requires internet connectivity.

## Validation

TypeScript and repository regression tests cover calendar month/leap-day boundaries, adjustable budgets and identical group filter counts across different personal voting perspectives. Live two-account Supabase and physical phone verification still require database setup. No development servers were started.
