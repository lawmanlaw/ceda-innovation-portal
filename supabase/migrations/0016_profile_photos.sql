-- Optional profile photos. Re-encoded on the server (no hidden metadata), visible only to
-- the person and CEDA staff, deleted with the account.
alter table public.profiles add column if not exists photo_v int not null default 0;

create table if not exists public.profile_photos (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data bytea not null check (octet_length(data) <= 400000),
  updated_at timestamptz not null default now()
);
alter table public.profile_photos enable row level security;
drop policy if exists "photos: self and staff read" on public.profile_photos;
create policy "photos: self and staff read" on public.profile_photos for select to authenticated
  using (user_id = auth.uid() or public.has_role('admin', 'adjudicator', 'evaluator', 'agent', 'observer'));
drop policy if exists "photos: self writes" on public.profile_photos;
create policy "photos: self writes" on public.profile_photos for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "photos: self updates" on public.profile_photos;
create policy "photos: self updates" on public.profile_photos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "photos: self deletes" on public.profile_photos;
create policy "photos: self deletes" on public.profile_photos for delete to authenticated using (user_id = auth.uid());
revoke all on public.profile_photos from anon;

create or replace function public.bump_photo()
returns void language sql security definer set search_path = public
as $$ update public.profiles set photo_v = case when exists (select 1 from public.profile_photos where user_id = auth.uid()) then photo_v + 1 else 0 end where id = auth.uid() $$;
revoke execute on function public.bump_photo() from public, anon;
grant execute on function public.bump_photo() to authenticated;
