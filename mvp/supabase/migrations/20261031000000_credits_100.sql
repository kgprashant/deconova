-- Every user gets 100 credits. New profiles start at 100; existing users get +100 once.
alter table public.profiles alter column credits set default 100;
update public.profiles set credits = credits + 100;
-- users who signed in before but have no profile row yet
insert into public.profiles (id, credits)
select u.id, 100 from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
