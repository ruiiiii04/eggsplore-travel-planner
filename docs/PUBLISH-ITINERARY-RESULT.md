# Immediate itinerary display after publication

Apply supabase/migrations/015_publish_itinerary_result.sql after migration 014. It adds publish_shared_candidate_plan, retaining the ownership and itinerary snapshot checks from migrations 006 and 013. Publication validates that the shared draft still matches the reviewed plan; unrelated votes no longer invalidate it. The transaction returns actual saved itinerary rows and keeps flexible-day counts. An empty saved result rolls back instead of reporting success.

The client displays returned rows immediately, expands the days and switches to Full Itinerary, without waiting for another network query. Initial responses started before publication cannot overwrite the saved rows or trip day count.

The itinerary banner Edit button opens an activity chooser to edit activity names, places, dates/days and times. An empty itinerary offers Add Activity. Only the leader can edit the shared itinerary. The Notes banner continues to operate on notes.

The migration has not been applied to the live database automatically. Live publication testing still requires setup. No development servers were started.

Apply supabase/migrations/016_preserve_new_published_activities.sql after 015 to fix publication of new activities. The merge function from 006 inserted new rows and then deleted every row absent from the existing_id list, including those new rows. Migration 016 deletes excluded existing rows before inserting new activities. Existing activity IDs, snapshot validation, ownership checks, and atomic rollback remain in place. Migration 015 should retain its empty-result check. Retry the reviewed draft after applying 016; failed publications were rolled back.
