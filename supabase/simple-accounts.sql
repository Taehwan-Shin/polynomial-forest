begin;
create schema if not exists forest_private;
revoke all on schema forest_private from public, anon, authenticated;
create table forest_private.accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 digest text unique not null check (digest ~ '^[a-f0-9]{64}$'),
 valid_after bigint not null default 0
);
alter table forest_private.accounts enable row level security;
create table forest_private.auth_limits (
 bucket text primary key,
 started_at timestamptz not null,
 requests integer not null
);
alter table forest_private.auth_limits enable row level security;
create function public.forest_auth_limit(bucket_key text, maximum integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare amount integer;
begin
 if bucket_key !~ '^[a-z]+:[a-f0-9]{64}$' or maximum < 1 or maximum > 250 then return false; end if;
 delete from forest_private.auth_limits where started_at < now() - interval '1 day';
 insert into forest_private.auth_limits as t values(bucket_key, now(), 1)
 on conflict(bucket) do update set
 requests = case when t.started_at < now() - interval '15 minutes' then 1 else least(t.requests+1, 10000) end,
 started_at = case when t.started_at < now() - interval '15 minutes' then now() else t.started_at end
 returning requests into amount;
 return amount <= maximum;
end $$;
create function public.forest_register_account(account_id uuid, account_digest text) returns void
language sql security definer set search_path = '' as $$
 insert into forest_private.accounts(user_id,digest) values(account_id,account_digest);
$$;
create function public.forest_invalidate_account(account_digest text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
 update forest_private.accounts set valid_after = floor(extract(epoch from now()))::bigint + 1
 where digest = account_digest returning user_id into target;
 return target;
end $$;
create function forest_private.forest_session_valid() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from forest_private.accounts
 where user_id = (select auth.uid()) and exists(select 1 from auth.sessions s where s.user_id = accounts.user_id and s.id::text = ((select auth.jwt())->>'session_id') and extract(epoch from s.created_at) >= valid_after));
$$;
revoke all on function public.forest_auth_limit(text,integer), public.forest_register_account(uuid,text), public.forest_invalidate_account(text), forest_private.forest_session_valid() from public,anon,authenticated;
grant execute on function public.forest_auth_limit(text,integer), public.forest_register_account(uuid,text), public.forest_invalidate_account(text) to service_role;
grant execute on function forest_private.forest_session_valid() to authenticated;
drop policy google_accounts_only on public.forest_attempts;
create policy simple_accounts_only on public.forest_attempts as restrictive to authenticated
 using ((select forest_private.forest_session_valid())) with check ((select forest_private.forest_session_valid()));
grant usage on schema forest_private to authenticated;
create policy no_direct_account_access on forest_private.accounts as restrictive for all to public using(false) with check(false);
create policy no_direct_limit_access on forest_private.auth_limits as restrictive for all to public using(false) with check(false);
commit;
