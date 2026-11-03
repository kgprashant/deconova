-- Admin dashboard backend (used by the dn-admin edge function)
create table if not exists public.dn_admins (email text primary key, created_at timestamptz default now());
alter table public.dn_admins enable row level security;
insert into public.dn_admins(email) values ('prashant.southavenue@gmail.com') on conflict do nothing;
-- To add an admin:  insert into public.dn_admins(email) values ('someone@example.com');

create or replace function public.dn_admin_query(q text, max_rows int default 500)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_catalog as $$
declare s text; r jsonb;
begin
  s := regexp_replace(btrim(coalesce(q,'')), ';+\s*$', '');
  if s = '' then raise exception 'empty query'; end if;
  if s ~ ';' then raise exception 'one statement only'; end if;
  if s !~* '^(select|with)[\s(]' then raise exception 'read-only: start with SELECT or WITH'; end if;
  perform set_config('transaction_read_only','on',true);
  perform set_config('statement_timeout','8000',true);
  execute format('select coalesce(jsonb_agg(t),''[]''::jsonb) from (select * from (%s) s limit %s) t', s, greatest(1,least(coalesce(max_rows,500),2000))) into r;
  return r;
end $$;
revoke all on function public.dn_admin_query(text,int) from public, anon, authenticated;
grant execute on function public.dn_admin_query(text,int) to service_role;
