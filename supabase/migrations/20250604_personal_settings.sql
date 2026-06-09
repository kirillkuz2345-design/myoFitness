-- Run in Supabase SQL Editor (or via CLI) before using Personal Settings sync.

-- Extend profiles with body metrics
alter table public.profiles
  add column if not exists gender text check (gender in ('male', 'female', 'other')),
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric;

-- Trainer-private notes per client (one row per trainer + client)
create table if not exists public.trainer_client_notes (
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (trainer_id, client_id)
);

create index if not exists trainer_client_notes_trainer_idx
  on public.trainer_client_notes (trainer_id);

alter table public.trainer_client_notes enable row level security;

-- Trainers: read/write only their notes for clients assigned to them
create policy "trainers_manage_own_client_notes"
  on public.trainer_client_notes
  for all
  using (
    auth.uid() = trainer_id
    and exists (
      select 1 from public.profiles p
      where p.id = client_id
        and p.trainer_id = trainer_id
        and p.role = 'client'
    )
  )
  with check (
    auth.uid() = trainer_id
    and exists (
      select 1 from public.profiles p
      where p.id = client_id
        and p.trainer_id = trainer_id
        and p.role = 'client'
    )
  );

-- Clients update only their own profile fields
create policy "users_update_own_profile_metrics"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
