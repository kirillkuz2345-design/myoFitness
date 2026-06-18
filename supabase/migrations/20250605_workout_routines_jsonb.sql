-- WorkoutRoutine hybrid storage: JSONB blocks on workouts table
alter table public.workouts
  add column if not exists blocks jsonb default '[]'::jsonb,
  add column if not exists recommendations text default '',
  add column if not exists athlete_comment text,
  add column if not exists updated_at timestamptz default now();

create index if not exists workouts_client_date_idx
  on public.workouts (client_id, date);

alter publication supabase_realtime add table public.workouts;

alter publication supabase_realtime add table public.workout_blocks;
