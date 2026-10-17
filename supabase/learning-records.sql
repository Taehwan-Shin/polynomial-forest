begin;
create table public.forest_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null,
  stage text not null check (stage in ('operations', 'remainder', 'factor')),
  character text not null check (character in ('squirrel', 'turtle')),
  mode text not null check (mode in ('adventure', 'quiz')),
  score integer not null check (score between 0 and 720),
  correct_count integer not null check (correct_count between 0 and 6),
  hits integer not null check (hits between 0 and 100000),
  acorns integer not null check (acorns between 0 and 12),
  answers smallint[] not null check (array_ndims(answers) = 1 and array_length(answers, 1) = 6 and array_lower(answers, 1) = 1 and 0 <= all(answers) and 3 >= all(answers) and array_position(answers, null) is null),
  created_at timestamptz not null default now(),
  primary key (user_id, attempt_id),
  check (mode <> 'quiz' or (hits = 0 and acorns = 0 and score = correct_count * 100)),
  check (score <= correct_count * 100 + acorns * 10),
  check (correct_count =
    (answers[1] = case stage when 'remainder' then 2 else 0 end)::int +
    (answers[2] = case stage when 'remainder' then 3 else 1 end)::int +
    (answers[3] = case stage when 'remainder' then 0 else 2 end)::int +
    (answers[4] = case stage when 'remainder' then 1 else 3 end)::int +
    (answers[5] = case stage when 'remainder' then 2 else 0 end)::int +
    (answers[6] = case stage when 'remainder' then 3 else 1 end)::int)
);
alter table public.forest_attempts enable row level security;
alter table public.forest_attempts force row level security;
revoke all on public.forest_attempts from anon, authenticated;
grant select, delete on public.forest_attempts to authenticated;
grant insert (user_id, attempt_id, stage, character, mode, score, correct_count, hits, acorns, answers) on public.forest_attempts to authenticated;
create policy own_records_read on public.forest_attempts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy own_records_insert on public.forest_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy own_records_delete on public.forest_attempts for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy google_accounts_only on public.forest_attempts as restrictive to authenticated
  using ((select auth.jwt()->'app_metadata'->>'provider') = 'google')
  with check ((select auth.jwt()->'app_metadata'->>'provider') = 'google');
comment on table public.forest_attempts is 'Private self-reported learning attempts. No shared rankings or assessment decisions. Append-only; owners can delete their records.';
create index forest_attempts_recent on public.forest_attempts(user_id, created_at desc);
create view public.forest_summary with (security_invoker = true) as
select user_id, jsonb_build_object(
  'best', jsonb_build_object('operations', coalesce(max(score) filter (where stage = 'operations'), 0), 'remainder', coalesce(max(score) filter (where stage = 'remainder'), 0), 'factor', coalesce(max(score) filter (where stage = 'factor'), 0)),
  'characters', array_remove(array[case when bool_or(character = 'squirrel') then 'squirrel' end, case when bool_or(character = 'turtle') then 'turtle' end], null),
  'badges', array_remove(array[case when bool_or(stage = 'operations') then 'operations' end, case when bool_or(stage = 'remainder') then 'remainder' end, case when bool_or(stage = 'factor') then 'factor' end, case when bool_or(correct_count = 6) then 'scholar' end, case when bool_or(mode = 'adventure' and hits = 0) then 'explorer' end, case when bool_or(character = 'squirrel') and bool_or(character = 'turtle') then 'friends' end], null)
) as record from public.forest_attempts group by user_id;
revoke all on public.forest_summary from anon, authenticated;
grant select on public.forest_summary to authenticated;
commit;
