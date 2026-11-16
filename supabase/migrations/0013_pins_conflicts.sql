-- Reviewer map tools: idea pins, similar ideas nearby, and conflict-of-interest opt-out.

-- 1. Where the idea will happen. Visible to the owner and to reviewers/staff through the existing idea RLS.
alter table public.ideas add column if not exists lat double precision;
alter table public.ideas add column if not exists lng double precision;
alter table public.ideas add column if not exists connect_ok boolean not null default false;
alter table public.ideas drop constraint if exists ideas_pin_in_botswana;
alter table public.ideas add constraint ideas_pin_in_botswana check (
  (lat is null and lng is null) or (lat between -27.0 and -17.6 and lng between 19.8 and 29.5));

create or replace function public.set_idea_pin(p_idea uuid, p_lat double precision, p_lng double precision, p_connect boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if (p_lat is null) <> (p_lng is null) then raise exception 'Pin needs both coordinates' using errcode = '22023'; end if;
  if p_lat is not null and not (p_lat between -27.0 and -17.6 and p_lng between 19.8 and 29.5) then
    raise exception 'Place the pin inside Botswana.' using errcode = '22023';
  end if;
  update public.ideas set lat = round(p_lat::numeric, 5), lng = round(p_lng::numeric, 5),
         connect_ok = coalesce(p_connect, false), updated_at = now()
   where id = p_idea and owner_id = auth.uid() and stage in ('draft', 'feedback');
  if not found then raise exception 'This idea can no longer be changed' using errcode = '42501'; end if;
end $$;
revoke execute on function public.set_idea_pin(uuid, double precision, double precision, boolean) from public, anon;
grant execute on function public.set_idea_pin(uuid, double precision, double precision, boolean) to authenticated;

create or replace function public.km_between(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns numeric
language sql immutable set search_path = public
as $$
  select round((6371 * 2 * asin(sqrt(power(sin(radians(b_lat - a_lat) / 2), 2)
    + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))))::numeric, 1)
$$;

-- 2. Similar ideas nearby: same category within 100 km. Reviewers and staff only; returns titles, not content.
create or replace function public.similar_ideas(p_idea uuid)
returns table (id uuid, ref text, title text, district text, stage public.idea_stage, km numeric, connect_ok boolean)
language sql stable security definer set search_path = public
as $$
  select * from (
    select o.id, o.ref, o.title, o.district, o.stage, public.km_between(me.lat, me.lng, o.lat, o.lng) km, o.connect_ok
    from public.ideas me join public.ideas o
      on o.id <> me.id and o.category_id = me.category_id and o.stage <> 'draft' and o.lat is not null
    where me.id = p_idea and me.lat is not null
      and public.can_see_idea(p_idea) and public.has_role('admin', 'adjudicator', 'evaluator', 'observer')
  ) x where km <= 100 order by km limit 5
$$;
revoke execute on function public.similar_ideas(uuid) from public, anon;
grant execute on function public.similar_ideas(uuid) to authenticated;

-- 3. Conflict of interest: the reviewer steps out, the idea goes to another reviewer, and it is logged.
create table if not exists public.conflicts (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  evaluator_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  replaced_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (idea_id, evaluator_id)
);
alter table public.conflicts enable row level security;
drop policy if exists "conflicts: panel and self read" on public.conflicts;
create policy "conflicts: panel and self read" on public.conflicts for select to authenticated
  using (evaluator_id = auth.uid() or public.has_role('admin', 'adjudicator'));
drop trigger if exists conflicts_audit on public.conflicts;
create trigger conflicts_audit after insert or update or delete on public.conflicts
  for each row execute function public.write_audit();

create or replace function public.declare_conflict(p_idea uuid, p_reason text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  a public.assignments;
  i public.ideas;
  nxt uuid;
  r record;
begin
  select * into a from public.assignments where idea_id = p_idea and evaluator_id = auth.uid();
  if a.idea_id is null then raise exception 'You are not assigned to this idea' using errcode = '42501'; end if;
  if a.submitted_at is not null then raise exception 'You already submitted your scores for this idea' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Say briefly why, for the record.' using errcode = '22023'; end if;
  select * into i from public.ideas where id = p_idea;

  select p.id into nxt from public.profiles p
   where p.role = 'evaluator' and p.id <> auth.uid() and p.id <> i.owner_id
     and not exists (select 1 from public.assignments x where x.idea_id = p_idea and x.evaluator_id = p.id)
     and not exists (select 1 from public.conflicts c where c.idea_id = p_idea and c.evaluator_id = p.id)
   order by (select count(*) from public.assignments x where x.evaluator_id = p.id and x.submitted_at is null), random()
   limit 1;

  insert into public.conflicts (idea_id, evaluator_id, reason, replaced_by)
  values (p_idea, auth.uid(), left(btrim(p_reason), 500), nxt);
  delete from public.scores where idea_id = p_idea and evaluator_id = auth.uid();
  delete from public.assignments where idea_id = p_idea and evaluator_id = auth.uid();

  if nxt is not null then
    insert into public.assignments (idea_id, evaluator_id, assigned_by) values (p_idea, nxt, null);
    perform public.notify(nxt, p_idea, 'New idea to evaluate', i.ref || ': ' || i.title);
  end if;
  for r in select id from public.profiles where role in ('admin', 'adjudicator') loop
    perform public.notify(r.id, p_idea, 'Conflict of interest declared',
      i.ref || case when nxt is null then ': no other evaluator is free, please assign one.' else ': reassigned automatically.' end);
  end loop;
  return nxt is not null;
end $$;
revoke execute on function public.declare_conflict(uuid, text) from public, anon;
grant execute on function public.declare_conflict(uuid, text) to authenticated;

-- A reviewer who declared a conflict can never be put back on that idea
create or replace function public.no_self_evaluation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.ideas where id = new.idea_id and owner_id = new.evaluator_id) then
    raise exception 'An evaluator cannot be assigned to their own idea' using errcode = '22023';
  end if;
  if exists (select 1 from public.ideas where id = new.idea_id and stage = 'draft') then
    raise exception 'Drafts cannot be evaluated' using errcode = '22023';
  end if;
  if exists (select 1 from public.conflicts where idea_id = new.idea_id and evaluator_id = new.evaluator_id) then
    raise exception 'This evaluator declared a conflict of interest on this idea' using errcode = '22023';
  end if;
  return new;
end $$;
