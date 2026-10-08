# Candidate publishing and Home invitations

Apply migration 013_atomic_candidate_publish.sql after 012. The new publish_shared_candidate_draft RPC checks leader ownership and the reviewed pool revision, then writes the itinerary and published pool status in one transaction. An outdated draft or changed existing itinerary is rejected without partial publication. Existing snapshot validations are reused. Lock waits are limited to five seconds; the client waits at most twenty seconds. If a request times out, reopen the itinerary before retrying because the server may have committed.

Realtime subscription names now include a fresh UUID for every effect setup. This prevents the Supabase client from returning a previously subscribed channel during rapid navigation, Fast Refresh or effect remounting. Cleanup removes only that effect's channel. Polling skips publication so it does not compete with the publish request.

Home Invite Members opens the member-management sheet for an active/upcoming trip led by the current user. Search for a registered user's username and add them. Members cannot invite; existing database policies enforce this.

Get more ideas is currently destination-based, excludes already-present places and uses a varied interest mix. The caller does not send member profile preferences. It does not claim to provide group preference personalization. Rebuild combines the current itinerary and confirmed candidates, resets manual draft edits/exclusions, and saves the shared replacement draft. It does not publish it.

No servers or live database migrations were started/applied automatically. Verify two-account publication and invitation flows after applying 013.
