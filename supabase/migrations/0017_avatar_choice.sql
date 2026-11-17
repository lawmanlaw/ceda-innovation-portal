-- A drawn avatar people can pick instead of a photo
alter table public.profiles add column if not exists avatar text check (avatar ~ '^[a-z]{2,16}$');
