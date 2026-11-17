-- Community reports and votes open without the server key. Abuse is limited by caps:
-- per device (cookie), per connection, and site-wide. Photos are only served once approved.
drop function if exists public.report_challenge(text, text, text, text, text, text, double precision, double precision, bytea, text);
create or replace function public.report_challenge(p_device text, p_net text, p_title text, p_description text,
  p_sector text, p_district text, p_lat double precision, p_lng double precision, p_photo bytea, p_mime text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare c text; new_id uuid;
begin
  if coalesce(p_device, '') !~ '^[0-9a-f]{16,64}$' or coalesce(p_net, '') !~ '^[0-9a-f]{16,64}$' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.rate_ok('report-dev:' || p_device, 3, interval '1 day') then
    raise exception 'You can send up to 3 reports a day from this device. Please try again tomorrow.' using errcode = '54000';
  end if;
  if not public.rate_ok('report-net:' || p_net, 10, interval '1 day') or not public.rate_ok('report:all', 300, interval '1 day') then
    raise exception 'We are receiving a lot of reports right now. Please try again tomorrow.' using errcode = '54000';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 8 and 120 or char_length(btrim(coalesce(p_description, ''))) not between 20 and 1500 then
    raise exception 'Check the title and description' using errcode = '22023';
  end if;
  if p_photo is not null and (p_mime is distinct from 'image/webp' or octet_length(p_photo) > 1500000) then
    raise exception 'Photo refused' using errcode = '22023';
  end if;
  c := 'BW-' || upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 6));
  insert into public.challenges (code, title, description, sector, district, lat, lng, has_photo)
  values (c, btrim(p_title), btrim(p_description), left(nullif(btrim(coalesce(p_sector, '')), ''), 60),
          left(p_district, 60), p_lat, p_lng, p_photo is not null)
  returning id into new_id;
  if p_photo is not null then insert into public.challenge_photos values (new_id, p_mime, p_photo); end if;
  return c;
end $$;

drop function if exists public.upvote_challenge(text, text, text, uuid);
create or replace function public.upvote_challenge(p_net text, p_device text, p_challenge uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if coalesce(p_device, '') !~ '^[0-9a-f]{16,64}$' or coalesce(p_net, '') !~ '^[0-9a-f]{16,64}$' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.challenges where id = p_challenge and status = 'approved') then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.challenge_votes where challenge_id = p_challenge and voter = p_device) then
    select upvotes into n from public.challenges where id = p_challenge;
    return n;
  end if;
  if not public.rate_ok('vote-dev:' || p_device, 40, interval '1 day') or not public.rate_ok('vote-net:' || p_net, 150, interval '1 day') then
    raise exception 'You have voted a lot today. Please try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.challenge_votes (challenge_id, voter) values (p_challenge, p_device) on conflict do nothing;
  if found then update public.challenges set upvotes = upvotes + 1 where id = p_challenge; end if;
  select upvotes into n from public.challenges where id = p_challenge;
  return n;
end $$;

drop function if exists public.challenge_photo(text, uuid);
create or replace function public.challenge_photo(p_challenge uuid)
returns table (mime text, data bytea)
language sql stable security definer set search_path = public
as $$
  select p.mime, p.data from public.challenge_photos p join public.challenges c on c.id = p.challenge_id
  where p.challenge_id = p_challenge and (c.status = 'approved' or public.has_role('admin'))
$$;

revoke execute on function public.report_challenge(text, text, text, text, text, text, double precision, double precision, bytea, text),
  public.upvote_challenge(text, text, uuid), public.challenge_photo(uuid) from public;
grant execute on function public.report_challenge(text, text, text, text, text, text, double precision, double precision, bytea, text),
  public.upvote_challenge(text, text, uuid), public.challenge_photo(uuid) to anon, authenticated;
