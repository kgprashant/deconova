-- DecoNova hackathon MVP schema. Runs on the Supabase free plan.
-- Everything is private by row-level security; the client never touches credits.

-- Per-user key/value store used by the web app (rooms, thumbnails, settings).
create table if not exists kv (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  k          text not null,
  v          text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);
alter table kv enable row level security;
create policy "own kv" on kv for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Credits. Read-only for the user; changed only by the functions below.
create table if not exists profiles (
  id      uuid primary key references auth.users on delete cascade,
  credits int not null default 5
);
alter table profiles enable row level security;
create policy "read own profile" on profiles for select using (auth.uid() = id);

-- One row per paid image call. Gives idempotency and a hard global spend cap.
create table if not exists render_log (
  request_id text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  mode       text,
  status     text not null default 'pending' check (status in ('pending','done','failed')),
  created_at timestamptz not null default now()
);
alter table render_log enable row level security;   -- no policies: clients cannot read or write

create or replace function spend_credit(p_user uuid, p_request text, p_mode text, p_max_total int)
returns int language plpgsql security definer set search_path = public as $$
declare remaining int; total int;
begin
  insert into profiles(id) values (p_user) on conflict do nothing;
  if exists (select 1 from render_log where request_id = p_request) then
    raise exception 'duplicate';
  end if;
  select count(*) into total from render_log where status <> 'failed';
  if total >= p_max_total then raise exception 'cap'; end if;
  update profiles set credits = credits - 1
    where id = p_user and credits > 0 returning credits into remaining;
  if remaining is null then raise exception 'no_credits'; end if;
  insert into render_log(request_id, user_id, mode) values (p_request, p_user, p_mode);
  return remaining;
end $$;

create or replace function refund_credit(p_user uuid, p_request text)
returns int language plpgsql security definer set search_path = public as $$
declare remaining int;
begin
  update render_log set status = 'failed'
    where request_id = p_request and user_id = p_user and status = 'pending';
  if found then
    update profiles set credits = credits + 1 where id = p_user returning credits into remaining;
  else
    select credits into remaining from profiles where id = p_user;
  end if;
  return remaining;
end $$;

create or replace function finish_render(p_user uuid, p_request text)
returns void language sql security definer set search_path = public as $$
  update render_log set status = 'done' where request_id = p_request and user_id = p_user;
$$;

revoke all on function spend_credit(uuid,text,text,int) from public, anon, authenticated;
revoke all on function refund_credit(uuid,text)         from public, anon, authenticated;
revoke all on function finish_render(uuid,text)         from public, anon, authenticated;
grant execute on function spend_credit(uuid,text,text,int) to service_role;
grant execute on function refund_credit(uuid,text)         to service_role;
grant execute on function finish_render(uuid,text)         to service_role;
