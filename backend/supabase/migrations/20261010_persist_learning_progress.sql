alter table public.learning_sessions
    add column if not exists scenario text,
    add column if not exists title text,
    add column if not exists description text,
    add column if not exists level public.cefr_level not null default 'B1';

create table if not exists public.reading_progress (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    text_id uuid not null references public.reading_contents(id) on delete cascade,
    progress integer not null default 0 check (progress between 0 and 100),
    time_spent integer not null default 0 check (time_spent >= 0),
    words_read integer not null default 0 check (words_read >= 0),
    is_completed boolean not null default false,
    updated_at timestamptz not null default now(),
    unique (user_id, text_id)
);

alter table public.reading_progress enable row level security;
grant select, insert, update, delete on public.reading_progress to authenticated;

drop policy if exists "Users can manage their reading progress"
    on public.reading_progress;
create policy "Users can manage their reading progress"
    on public.reading_progress for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());