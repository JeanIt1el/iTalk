-- iTalk data model for Supabase PostgreSQL
create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
create type public.module_type as enum ('conversation', 'reading', 'grammar', 'vocabulary', 'speaking', 'listening');
create type public.sender_role as enum ('user', 'assistant', 'system');
create type public.correction_category as enum ('spelling', 'grammar', 'punctuation', 'word_choice', 'syntax');
create type public.srs_rating as enum ('again', 'hard', 'good', 'easy');

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    native_language text not null default 'fr',
    target_language text not null default 'en',
    level public.cefr_level not null default 'A1',
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, full_name)
    values (
        new.id,
        coalesce(
            nullif(new.raw_user_meta_data ->> 'full_name', ''),
            nullif(new.raw_user_meta_data ->> 'name', ''),
            nullif(new.email, ''),
            'Utilisateur'
        )
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

create table if not exists public.learning_preferences (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    daily_goal_minutes integer not null default 20 check (daily_goal_minutes between 1 and 480),
    topics text[] not null default array[]::text[],
    interests text[] not null default array[]::text[],
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id)
);

create table if not exists public.learning_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    module_type public.module_type not null,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    score integer check (score between 0 and 100),
    duration_seconds integer check (duration_seconds >= 0),
    created_at timestamptz not null default now()
);

alter table public.learning_sessions
    add column if not exists scenario text,
    add column if not exists title text,
    add column if not exists description text,
    add column if not exists level public.cefr_level not null default 'B1';

create table if not exists public.conversation_messages (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.learning_sessions(id) on delete cascade,
    sender_role public.sender_role not null,
    content text not null,
    translation text,
    timestamp timestamptz not null default now()
);

create table if not exists public.corrections (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references public.conversation_messages(id) on delete cascade,
    original_text text not null,
    corrected_text text not null,
    category public.correction_category not null,
    explanation text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.vocabulary_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    word text not null,
    translation text not null,
    context_sentence text,
    next_review_at timestamptz not null default now(),
    interval_days integer not null default 1 check (interval_days >= 0),
    srs_level integer not null default 0 check (srs_level between 0 and 5),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.reading_contents (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    level public.cefr_level not null,
    topic text not null,
    content text not null,
    questions jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

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

create table if not exists public.skill_progress (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    skill_name text not null,
    level_estimate public.cefr_level not null,
    updated_at timestamptz not null default now(),
    unique (user_id, skill_name)
);

create table if not exists public.review_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    vocabulary_item_id uuid not null references public.vocabulary_items(id) on delete cascade,
    rating public.srs_rating not null,
    reviewed_at timestamptz not null default now()
);

create table if not exists public.consent_records (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    audio_processing boolean not null default false,
    analytics boolean not null default false,
    privacy_policy_accepted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists profiles_target_language_idx on public.profiles (target_language);
create index if not exists learning_sessions_user_started_idx on public.learning_sessions (user_id, started_at desc);
create index if not exists conversation_messages_session_timestamp_idx on public.conversation_messages (session_id, timestamp);
create index if not exists vocabulary_items_user_next_review_idx on public.vocabulary_items (user_id, next_review_at);
create index if not exists skill_progress_user_idx on public.skill_progress (user_id);

alter table public.profiles enable row level security;
alter table public.learning_preferences enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.corrections enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.skill_progress enable row level security;
alter table public.review_events enable row level security;
alter table public.reading_progress enable row level security;
grant select, insert, update, delete on public.reading_progress to authenticated;
alter table public.consent_records enable row level security;

create policy "Users can manage their profile"
    on public.profiles for all
    using (id = auth.uid())
    with check (id = auth.uid());

create policy "Users can manage their learning preferences"
    on public.learning_preferences for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can manage their learning sessions"
    on public.learning_sessions for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can manage their conversation messages"
    on public.conversation_messages for all
    using (session_id in (
        select id from public.learning_sessions where user_id = auth.uid()
    ))
    with check (session_id in (
        select id from public.learning_sessions where user_id = auth.uid()
    ));

create policy "Users can manage their corrections"
    on public.corrections for all
    using (message_id in (
        select conversation_messages.id from public.conversation_messages
        join public.learning_sessions on learning_sessions.id = conversation_messages.session_id
        where learning_sessions.user_id = auth.uid()
    ))
    with check (message_id in (
        select conversation_messages.id from public.conversation_messages
        join public.learning_sessions on learning_sessions.id = conversation_messages.session_id
        where learning_sessions.user_id = auth.uid()
    ));

create policy "Users can manage their vocabulary"
    on public.vocabulary_items for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can manage their skill progress"
    on public.skill_progress for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can manage their review events"
    on public.review_events for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can manage their reading progress"
    on public.reading_progress for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Users can manage their consent records"
    on public.consent_records for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Reading content is publicly readable"
    on public.reading_contents for select
    using (true);
