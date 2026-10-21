alter table public.vocabulary_quiz_sessions
    add column if not exists time_limit_seconds smallint
        check (time_limit_seconds in (60, 120)),
    add column if not exists deadline_at timestamptz;

revoke all on function public.create_vocabulary_quiz(uuid, text[], jsonb) from public, anon, authenticated;

create or replace function public.create_vocabulary_quiz(
    p_user_id uuid,
    p_vocabulary_item_slugs text[],
    p_questions jsonb,
    p_time_limit_seconds smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_quiz_id uuid := gen_random_uuid();
    v_started_at timestamptz := now();
    v_deadline_at timestamptz;
    v_public_questions jsonb;
begin
    if coalesce(auth.role(), '') <> 'service_role' then
        raise exception 'Server operation required' using errcode = '42501';
    end if;
    if p_user_id is null or jsonb_typeof(p_questions) <> 'array'
        or jsonb_array_length(p_questions) < 3
        or p_time_limit_seconds not in (60, 120) and p_time_limit_seconds is not null then
        raise exception 'Invalid quiz configuration' using errcode = '22023';
    end if;

    if p_time_limit_seconds is not null then
        v_deadline_at := v_started_at + make_interval(secs => p_time_limit_seconds);
    end if;

    select jsonb_agg(question.value - array['answer', 'accepted_answers', 'explanation', 'item_slug']
        order by (question.value ->> 'index')::integer)
    into v_public_questions
    from jsonb_array_elements(p_questions) as question(value);

    insert into public.vocabulary_quiz_sessions
        (id, user_id, vocabulary_item_slugs, questions, time_limit_seconds, deadline_at)
    values
        (v_quiz_id, p_user_id, p_vocabulary_item_slugs, v_public_questions,
            p_time_limit_seconds, v_deadline_at);

    insert into public.vocabulary_quiz_answer_keys
        (quiz_session_id, question_index, vocabulary_item_slug, correct_answer, accepted_answers, explanation)
    select
        v_quiz_id,
        (question.value ->> 'index')::integer,
        question.value ->> 'item_slug',
        question.value ->> 'answer',
        coalesce(array(select jsonb_array_elements_text(question.value -> 'accepted_answers')),
            array[question.value ->> 'answer']),
        question.value ->> 'explanation'
    from jsonb_array_elements(p_questions) as question(value);

    return jsonb_build_object(
        'id', v_quiz_id,
        'questions', v_public_questions,
        'answered_count', 0,
        'status', 'active',
        'score', null,
        'started_at', v_started_at,
        'time_limit_seconds', p_time_limit_seconds
    );
end;
$$;

revoke all on function public.create_vocabulary_quiz(uuid, text[], jsonb, smallint) from public, anon, authenticated;
grant execute on function public.create_vocabulary_quiz(uuid, text[], jsonb, smallint) to service_role;

create or replace function public.answer_vocabulary_quiz(
    p_user_id uuid,
    p_quiz_id uuid,
    p_question_index integer,
    p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_session public.vocabulary_quiz_sessions%rowtype;
    v_key public.vocabulary_quiz_answer_keys%rowtype;
    v_previous public.vocabulary_quiz_answers%rowtype;
    v_correct boolean;
    v_normalized text;
begin
    if auth.uid() is null or auth.uid() <> p_user_id then
        raise exception 'Not authorized' using errcode = '42501';
    end if;
    if length(p_answer) < 1 or length(p_answer) > 300 then
        raise exception 'Invalid answer' using errcode = '22023';
    end if;

    select * into v_session from public.vocabulary_quiz_sessions
    where id = p_quiz_id and user_id = p_user_id for update;
    if not found then
        raise exception 'Quiz not found' using errcode = 'P0002';
    end if;
    if v_session.status <> 'active' then
        raise exception 'Quiz is not active' using errcode = '55000';
    end if;
    if v_session.deadline_at is not null and now() >= v_session.deadline_at then
        raise exception 'Quiz time has expired' using errcode = '55000';
    end if;

    select * into v_key from public.vocabulary_quiz_answer_keys
    where quiz_session_id = p_quiz_id and question_index = p_question_index;
    if not found then
        raise exception 'Question not found' using errcode = 'P0002';
    end if;
    select * into v_previous from public.vocabulary_quiz_answers
    where quiz_session_id = p_quiz_id and question_index = p_question_index;
    if found then
        v_normalized := regexp_replace(lower(trim(p_answer)), '^[[:punct:][:space:]]+|[[:punct:][:space:]]+$', '', 'g');
        if v_normalized <> regexp_replace(lower(trim(v_previous.submitted_answer)), '^[[:punct:][:space:]]+|[[:punct:][:space:]]+$', '', 'g') then
            raise exception 'Question already answered' using errcode = '23505';
        end if;
        return jsonb_build_object(
            'question_index', p_question_index,
            'is_correct', v_previous.is_correct,
            'correct_answer', v_key.correct_answer,
            'explanation', v_key.explanation
        );
    end if;

    v_normalized := regexp_replace(lower(trim(p_answer)), '^[[:punct:][:space:]]+|[[:punct:][:space:]]+$', '', 'g');
    v_correct := exists (
        select 1 from unnest(v_key.accepted_answers) as answer(value)
        where v_normalized = regexp_replace(lower(trim(answer.value)), '^[[:punct:][:space:]]+|[[:punct:][:space:]]+$', '', 'g')
    );

    insert into public.vocabulary_quiz_answers
        (quiz_session_id, user_id, question_index, vocabulary_item_slug, submitted_answer, is_correct)
    values
        (p_quiz_id, p_user_id, p_question_index, v_key.vocabulary_item_slug, p_answer, v_correct);
    update public.vocabulary_quiz_sessions set
        answered_count = answered_count + 1,
        correct_answers = correct_answers + case when v_correct then 1 else 0 end
    where id = p_quiz_id and user_id = p_user_id;

    return jsonb_build_object(
        'question_index', p_question_index,
        'is_correct', v_correct,
        'correct_answer', v_key.correct_answer,
        'explanation', v_key.explanation
    );
end;
$$;

create or replace function public.finish_vocabulary_quiz(p_user_id uuid, p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_session public.vocabulary_quiz_sessions%rowtype;
    v_question_count integer;
    v_score integer;
begin
    if auth.uid() is null or auth.uid() <> p_user_id then
        raise exception 'Not authorized' using errcode = '42501';
    end if;
    select * into v_session from public.vocabulary_quiz_sessions
    where id = p_quiz_id and user_id = p_user_id for update;
    if not found then
        raise exception 'Quiz not found' using errcode = 'P0002';
    end if;

    v_question_count := jsonb_array_length(v_session.questions);
    if v_session.answered_count < v_question_count
        and (v_session.deadline_at is null or now() < v_session.deadline_at) then
        raise exception 'Answer all quiz questions before finishing' using errcode = '55000';
    end if;
    v_score := case when v_question_count = 0 then 0
        else round(v_session.correct_answers * 100.0 / v_question_count)::integer end;
    update public.vocabulary_quiz_sessions set
        status = 'completed',
        score = v_score,
        finished_at = coalesce(finished_at, now())
    where id = p_quiz_id and user_id = p_user_id;
    return jsonb_build_object(
        'id', p_quiz_id,
        'questions', v_session.questions,
        'answered_count', v_session.answered_count,
        'status', 'completed',
        'score', v_score,
        'started_at', v_session.created_at,
        'time_limit_seconds', v_session.time_limit_seconds
    );
end;
$$;