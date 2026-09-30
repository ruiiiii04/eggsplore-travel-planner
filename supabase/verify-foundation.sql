-- Read-only inspection. This is not a substitute for authenticated user tests.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('profiles','trips','trip_members','expenses','itinerary_items')
order by tablename;
select tablename, policyname, roles, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename in ('profiles','trips','trip_members','expenses','itinerary_items')
order by tablename, policyname;
select trigger_name,event_object_table,action_timing,event_manipulation from information_schema.triggers
where (event_object_schema='auth' and event_object_table='users')
   or (event_object_schema='public' and event_object_table in ('profiles','trips'));
