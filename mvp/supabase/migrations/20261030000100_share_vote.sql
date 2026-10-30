-- Share link + family vote. Run after the first migration.
-- Privacy: a share is reachable only by its unguessable id, expires after 30 days, and the owner can delete it at any time.
-- Visitors never get table access: they use the two functions below, which return only what that one link should show.

create table if not exists shares (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title      text not null check (char_length(title) <= 80),
  concepts   jsonb not null check (jsonb_typeof(concepts) = 'array' and jsonb_array_length(concepts) between 2 and 5),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
alter table shares enable row level security;
create policy "own shares" on shares for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists votes (
  share_id   uuid not null references shares on delete cascade,
  voter      text not null check (char_length(voter) between 8 and 64),   -- random token kept in the voter's browser
  concept    int  not null check (concept between 1 and 4),
  created_at timestamptz not null default now(),
  primary key (share_id, voter)
);
alter table votes enable row level security;   -- no policies: nobody reads or writes votes directly

create or replace function get_share(p_id uuid)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'title', s.title,
    'concepts', s.concepts,
    'tally', coalesce((select jsonb_object_agg(concept::text, n)
                       from (select concept, count(*) n from votes where share_id = s.id group by concept) v), '{}'::jsonb))
  from shares s where s.id = p_id and s.expires_at > now();
$$;

create or replace function cast_vote(p_share uuid, p_voter text, p_concept int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int; total int;
begin
  select jsonb_array_length(concepts) into n from shares where id = p_share and expires_at > now();
  if n is null then raise exception 'gone'; end if;
  if p_concept < 1 or p_concept > n - 1 then raise exception 'bad_choice'; end if;
  select count(*) into total from votes where share_id = p_share;
  if total >= 200 and not exists (select 1 from votes where share_id = p_share and voter = p_voter) then
    raise exception 'full';
  end if;
  insert into votes(share_id, voter, concept) values (p_share, p_voter, p_concept)
    on conflict (share_id, voter) do update set concept = excluded.concept;
  return get_share(p_share);
end $$;

revoke all on function get_share(uuid)           from public;
revoke all on function cast_vote(uuid,text,int)  from public;
grant execute on function get_share(uuid)          to anon, authenticated;
grant execute on function cast_vote(uuid,text,int) to anon, authenticated;
