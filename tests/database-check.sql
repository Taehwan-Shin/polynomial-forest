-- Entire test transaction is rolled back. These UUIDs are synthetic, not real accounts.
begin;
do $$begin
  if exists (select 1 from auth.users where id in ('00000000-0000-4000-8000-000000000001'::uuid,'00000000-0000-4000-8000-000000000002'::uuid)) then raise exception 'Synthetic ID collision; stop test'; end if;
end$$;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into auth.sessions(id,user_id,created_at,updated_at) values ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',now(),now()),('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',now(),now());
insert into forest_private.accounts(user_id,digest) values('00000000-0000-4000-8000-000000000001',repeat('a',64)),('00000000-0000-4000-8000-000000000002',repeat('b',64));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000001"}',true);
insert into public.forest_attempts(user_id,attempt_id,stage,character,mode,score,correct_count,hits,acorns,answers)
values('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','operations','squirrel','quiz',600,6,0,0,array[0,1,2,3,0,1]);
do $$begin
  if (select count(*) from public.forest_attempts) <> 1 then raise exception 'Own read failed'; end if;
  if (select record->'best'->>'operations' from public.forest_summary) <> '600' then raise exception 'Summary failed'; end if;
  begin
    insert into public.forest_attempts(user_id,attempt_id,stage,character,mode,score,correct_count,hits,acorns,answers)
    values('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','operations','squirrel','quiz',600,6,0,0,array[0,1,2,3,0,1]);
    raise exception 'Duplicate accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.forest_attempts(user_id,attempt_id,stage,character,mode,score,correct_count,hits,acorns,answers)
    values('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','operations','squirrel','quiz',600,6,0,0,array[3,1,2,3,0,1]);
    raise exception 'Forged answer count accepted';
  exception when check_violation then null; end;
  begin
    update public.forest_attempts set score = 0;
    raise exception 'Update allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.forest_attempts(user_id,attempt_id,stage,character,mode,score,correct_count,hits,acorns,answers,created_at)
    values('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','operations','squirrel','quiz',600,6,0,0,array[0,1,2,3,0,1],now());
    raise exception 'Client timestamp allowed';
  exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000002"}',true);
do $$declare removed integer; begin
  if (select count(*) from public.forest_attempts) <> 0 then raise exception 'Other account read leaked'; end if;
  if (select count(*) from public.forest_summary) <> 0 then raise exception 'Other account summary leaked'; end if;
  delete from public.forest_attempts; get diagnostics removed = row_count;
  if removed <> 0 then raise exception 'Other account deletion allowed'; end if;
  begin
    insert into public.forest_attempts(user_id,attempt_id,stage,character,mode,score,correct_count,hits,acorns,answers)
    values('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','operations','squirrel','quiz',600,6,0,0,array[0,1,2,3,0,1]);
    raise exception 'Other account insert allowed';
  exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000002"}',true);
do $$begin if (select count(*) from public.forest_attempts) <> 0 then raise exception 'Mismatched session read allowed'; end if; end$$;
reset role;
update forest_private.accounts set valid_after = floor(extract(epoch from now()))::bigint+1 where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000001","iat":9999999999}',true);
do $begin if(select count(*) from public.forest_attempts)<>0 then raise exception 'Old refreshed session accepted after reset';end if;end$;
reset role;
update forest_private.accounts set valid_after=0 where user_id='00000000-0000-4000-8000-000000000001';
set local role service_role;
do $begin
 if not public.forest_auth_limit('account:'||repeat('c',64),1) then raise exception 'First request denied';end if;
 if public.forest_auth_limit('account:'||repeat('c',64),1) then raise exception 'Limit bypass';end if;
end$;
set local role anon;
do $$begin
  begin perform count(*) from public.forest_attempts; raise exception 'Anon read allowed'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.forest_summary; raise exception 'Anon summary allowed'; exception when insufficient_privilege then null; end;
  if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') then raise exception 'Public privileged function allowed'; end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"20000000-0000-4000-8000-000000000001"}',true);
do $$declare removed integer; begin delete from public.forest_attempts; get diagnostics removed = row_count; if removed <> 1 then raise exception 'Owner deletion failed'; end if; end$$;
rollback;
select '17 database authorization, reset and rate-limit checks passed; synthetic users and records rolled back' as verification;
