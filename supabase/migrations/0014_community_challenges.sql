-- Community challenges: anyone can report a problem without an account. A moderator approves it,
-- then it appears on the public map as a challenge innovators can save to their basket of interests.
--
-- Anonymous writes go only through the portal's server (which runs the bot check, strips photo
-- metadata and rate-limits by device and network). The server proves itself with a key whose
-- SHA-256 hash is stored here; the key itself lives only in the hosting environment.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.server_keys (id int primary key default 1 check (id = 1), key_hash text not null);
alter table public.server_keys enable row level security;
revoke all on public.server_keys from public, anon, authenticated;

create or replace function public.server_ok(p_key text)
returns boolean
language sql stable security definer set search_path = public, extensions
as $$ select exists (select 1 from public.server_keys where key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')) $$;
revoke execute on function public.server_ok(text) from public, anon, authenticated;

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null check (char_length(title) between 8 and 120),
  description text not null check (char_length(description) between 20 and 1500),
  sector text check (char_length(sector) <= 60),
  district text,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  has_photo boolean not null default false,
  upvotes int not null default 0,
  moderated_by uuid references public.profiles (id),
  moderated_at timestamptz,
  moderator_note text check (char_length(moderator_note) <= 300),
  created_at timestamptz not null default now(),
  constraint challenge_in_botswana check (lat between -27.0 and -17.6 and lng between 19.8 and 29.5)
);
create index if not exists challenges_status_idx on public.challenges (status, upvotes desc);

create table if not exists public.challenge_photos (
  challenge_id uuid primary key references public.challenges (id) on delete cascade,
  mime text not null check (mime in ('image/webp', 'image/jpeg')),
  data bytea not null check (octet_length(data) <= 1500000)
);

create table if not exists public.challenge_votes (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  voter text not null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, voter)
);

create table if not exists public.rate_hits (key text not null, at timestamptz not null default now());
create index if not exists rate_hits_idx on public.rate_hits (key, at);

create table if not exists public.interests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  saved boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_photos enable row level security;
alter table public.challenge_votes enable row level security;
alter table public.rate_hits enable row level security;
alter table public.interests enable row level security;
revoke all on public.challenge_photos, public.challenge_votes, public.rate_hits from anon, authenticated;

drop policy if exists "challenges: approved are public" on public.challenges;
create policy "challenges: approved are public" on public.challenges for select to anon, authenticated
  using (status = 'approved' or public.has_role('admin'));
drop policy if exists "interests: own" on public.interests;
create policy "interests: own" on public.interests for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_role('submitter'));
revoke insert, update, delete on public.challenges from anon, authenticated;

drop trigger if exists challenges_audit on public.challenges;
create trigger challenges_audit after insert or update or delete on public.challenges
  for each row execute function public.write_audit();

-- true when this key has not hit the limit in the window; records the hit either way
create or replace function public.rate_ok(p_key text, p_max int, p_window interval)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  delete from public.rate_hits where at < now() - interval '1 day';
  select count(*) into n from public.rate_hits where key = p_key and at > now() - p_window;
  insert into public.rate_hits (key) values (p_key);
  return n < p_max;
end $$;
revoke execute on function public.rate_ok(text, int, interval) from public, anon, authenticated;

create or replace function public.report_challenge(p_server text, p_net text, p_title text, p_description text,
  p_sector text, p_district text, p_lat double precision, p_lng double precision, p_photo bytea, p_mime text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare c text; new_id uuid;
begin
  if not public.server_ok(p_server) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not public.rate_ok('report:' || p_net, 5, interval '1 hour') or not public.rate_ok('report:all', 200, interval '1 hour') then
    raise exception 'Too many reports from this connection. Please try again in an hour.' using errcode = '54000';
  end if;
  c := 'BW-' || upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 6));
  insert into public.challenges (code, title, description, sector, district, lat, lng, has_photo)
  values (c, btrim(p_title), btrim(p_description), nullif(btrim(coalesce(p_sector, '')), ''), p_district, p_lat, p_lng, p_photo is not null)
  returning id into new_id;
  if p_photo is not null then insert into public.challenge_photos values (new_id, p_mime, p_photo); end if;
  return c;
end $$;

create or replace function public.upvote_challenge(p_server text, p_net text, p_device text, p_challenge uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not public.server_ok(p_server) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.challenges where id = p_challenge and status = 'approved') then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if not public.rate_ok('vote:' || p_net, 30, interval '1 hour') then
    raise exception 'Too many votes from this connection. Please try again later.' using errcode = '54000';
  end if;
  insert into public.challenge_votes (challenge_id, voter) values (p_challenge, p_device) on conflict do nothing;
  if found then update public.challenges set upvotes = upvotes + 1 where id = p_challenge; end if;
  select upvotes into n from public.challenges where id = p_challenge;
  return n;
end $$;

create or replace function public.track_challenge(p_code text)
returns table (code text, title text, status text, created_at timestamptz, moderated_at timestamptz, upvotes int)
language sql stable security definer set search_path = public
as $$ select code, title, status, created_at, moderated_at, upvotes from public.challenges where code = upper(btrim(p_code)) $$;

create or replace function public.challenge_photo(p_server text, p_challenge uuid)
returns table (mime text, data bytea)
language sql stable security definer set search_path = public
as $$
  select p.mime, p.data from public.challenge_photos p join public.challenges c on c.id = p.challenge_id
  where p.challenge_id = p_challenge and public.server_ok(p_server)
$$;

create or replace function public.moderate_challenge(p_challenge uuid, p_approve boolean, p_keep_photo boolean, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role('admin') then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.challenges set status = case when p_approve then 'approved' else 'rejected' end,
         moderated_by = auth.uid(), moderated_at = now(), moderator_note = left(nullif(btrim(coalesce(p_note, '')), ''), 300),
         has_photo = has_photo and p_approve and coalesce(p_keep_photo, false)
   where id = p_challenge;
  if not found then raise exception 'Not found' using errcode = 'P0002'; end if;
  if not (p_approve and coalesce(p_keep_photo, false)) then delete from public.challenge_photos where challenge_id = p_challenge; end if;
end $$;

-- Analytics for CEDA
create or replace function public.challenge_report()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when public.has_role('admin', 'adjudicator') then jsonb_build_object(
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.challenges group by status) x),
    'by_district', (select coalesce(jsonb_object_agg(coalesce(district, 'Unknown'), n), '{}') from (select district, count(*) n from public.challenges where status = 'approved' group by district) x),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'district', district, 'upvotes', upvotes, 'saved', s) order by upvotes desc), '[]')
            from (select c.title, c.district, c.upvotes, (select count(*) from public.interests i where i.challenge_id = c.id and i.saved) s
                  from public.challenges c where status = 'approved' order by upvotes desc limit 8) t),
    'votes', (select coalesce(sum(upvotes), 0) from public.challenges),
    'saved', (select count(*) from public.interests where saved),
    'innovators_engaged', (select count(distinct user_id) from public.interests)
  ) end
$$;

revoke execute on function public.report_challenge(text, text, text, text, text, text, double precision, double precision, bytea, text),
  public.upvote_challenge(text, text, text, uuid), public.challenge_photo(text, uuid) from public;
grant execute on function public.report_challenge(text, text, text, text, text, text, double precision, double precision, bytea, text),
  public.upvote_challenge(text, text, text, uuid), public.challenge_photo(text, uuid), public.track_challenge(text) to anon, authenticated;
revoke execute on function public.moderate_challenge(uuid, boolean, boolean, text), public.challenge_report() from public, anon;
grant execute on function public.moderate_challenge(uuid, boolean, boolean, text), public.challenge_report() to authenticated;

-- Demo challenges so the map and swipe screen have something to show
insert into public.challenges (code, title, description, sector, district, lat, lng, status, upvotes, moderated_at) values
  ('BW-DEMO01', 'High cost of solar electricity in Gaborone', 'Small shops want to switch to solar but the panels and batteries cost more than a year of power bills. We need cheaper ways to buy or rent solar.', 'Energy', 'Gaborone', -24.63, 25.92, 'approved', 41, now()),
  ('BW-DEMO02', 'Broken boreholes leave cattle without water', 'Our syndicate borehole breaks down often and it takes weeks to get a mechanic and parts out to the cattle post.', 'Agriculture', 'Kweneng', -24.2, 25.1, 'approved', 27, now()),
  ('BW-DEMO03', 'Tomatoes rot before reaching market', 'Farmers near Pandamatenga lose much of the harvest because there is no cold storage or transport to town in time.', 'Agriculture', 'Chobe', -18.6, 25.5, 'approved', 19, now()),
  ('BW-DEMO04', 'No safe place to dry and sell mopane worms', 'Harvesters sell at very low prices to middlemen because there is no clean drying or packaging nearby.', 'Food processing', 'Central', -21.4, 27.3, 'approved', 15, now()),
  ('BW-DEMO05', 'Long queues for school uniforms every January', 'Parents travel far and queue for days. Local tailors could make uniforms but cannot get bulk fabric.', 'Manufacturing', 'Southern', -24.97, 25.34, 'approved', 12, now()),
  ('BW-DEMO06', 'Tourists cannot pay with cards at craft stalls', 'Basket weavers in Maun lose sales because visitors carry no cash and the stalls have no card machines.', 'Tourism', 'North-West', -19.98, 23.43, 'approved', 9, now()),
  ('BW-DEMO07', 'Plastic waste piling up at the bus rank', 'Bottles and bags collect at the Francistown bus rank. Nobody buys the plastic for recycling here.', 'Environment', 'Francistown', -21.17, 27.51, 'approved', 22, now()),
  ('BW-DEMO08', 'Ghanzi beef farmers lack local abattoir slots', 'Cattle must travel hundreds of kilometres to be slaughtered and farmers lose weight and money on the way.', 'Agriculture', 'Ghanzi', -21.7, 21.65, 'approved', 8, now())
on conflict (code) do nothing;

-- An admin links the server key from the portal's Settings page; only its hash is stored
create or replace function public.set_server_key_hash(p_hash text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role('admin') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Bad key' using errcode = '22023'; end if;
  insert into public.server_keys (id, key_hash) values (1, p_hash) on conflict (id) do update set key_hash = excluded.key_hash;
  insert into public.audit_log (actor_id, action, table_name, record_id) values (auth.uid(), 'server_key_linked', 'server_keys', '1');
end $$;
revoke execute on function public.set_server_key_hash(text) from public, anon;
grant execute on function public.set_server_key_hash(text) to authenticated;

create or replace function public.server_key_linked()
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role('admin') and exists (select 1 from public.server_keys) $$;
grant execute on function public.server_key_linked() to authenticated;
