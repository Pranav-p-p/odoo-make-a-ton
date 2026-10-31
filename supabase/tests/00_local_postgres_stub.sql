-- Imitates the parts of Supabase that the migrations rely on, so they run on plain PostgreSQL 16.
-- Do NOT run this on a real Supabase project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text not null unique,
  raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}',
  email_confirmed_at timestamptz default now());   -- tests insert verified users unless they say otherwise
-- Supabase reads the caller's id from the JWT; here it comes from a setting the tests change.
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
