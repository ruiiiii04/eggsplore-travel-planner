# Vote sync and draft removals

Apply migration 017_candidate_vote_sync.sql after 016 before using the updated client. Unchanged pool reads return only the revision and votes, avoiding repeated transfer of uploaded photos. Votes update just the caller vote rather than rewriting the candidate pool and deleting/reinserting all their votes. Content saves and votes use the same trip-before-pool lock order as publication, with a three-second lock timeout. Transient refresh failures back off and their error clears on recovery.

Removing an In Draft candidate also excludes its matching saved itinerary activity from the reviewed draft. Removing an activity in Review Draft deselects its candidate so it stays removed when review is reopened. Other edited activities and manual additions survive normal review synchronization. Rebuild explicitly resets the review and itinerary exclusions.

The migration has not been applied to the live database. These changes reduce known sources of database work and lock contention; a persistent server statement timeout still requires inspection of the live database.
