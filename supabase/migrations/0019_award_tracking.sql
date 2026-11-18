-- After an award: next steps (milestones) the panel sets and the innovator works through,
-- and a project space where the innovator, their evaluators and adjudicators share updates.
-- Administrators manage the system and are deliberately not part of the project space.
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  due_date date,
  done_at timestamptz,
  sort int not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists milestones_idea_idx on public.milestones (idea_id, sort);
alter table public.milestones enable row level security;

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists project_updates_idea_idx on public.project_updates (idea_id, created_at);
alter table public.project_updates enable row level security;

-- Who is part of an idea's project: its owner, its evaluators and adjudicators
create or replace function public.in_project(p_idea uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.ideas where id = p_idea and owner_id = auth.uid() and stage in ('approved', 'awarded'))
      or (exists (select 1 from public.ideas where id = p_idea and stage in ('approved', 'awarded'))
          and (public.has_role('adjudicator')
               or exists (select 1 from public.assignments where idea_id = p_idea and evaluator_id = auth.uid())))
$$;
revoke execute on function public.in_project(uuid) from public, anon;
grant execute on function public.in_project(uuid) to authenticated;

drop policy if exists "milestones: project and staff read" on public.milestones;
create policy "milestones: project and staff read" on public.milestones for select to authenticated
  using (public.in_project(idea_id) or public.has_role('admin', 'observer'));
drop policy if exists "milestones: panel writes" on public.milestones;
create policy "milestones: panel writes" on public.milestones for insert to authenticated
  with check (public.has_role('adjudicator', 'admin') and created_by = auth.uid());
drop policy if exists "milestones: panel deletes" on public.milestones;
create policy "milestones: panel deletes" on public.milestones for delete to authenticated
  using (public.has_role('adjudicator', 'admin'));

-- Ticking a step off: the innovator or the panel, and only the done flag changes
create or replace function public.toggle_milestone(p_id uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare m public.milestones;
begin
  select * into m from public.milestones where id = p_id;
  if m.id is null or not (public.in_project(m.idea_id) or public.has_role('admin')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.milestones set done_at = case when p_done then now() else null end where id = p_id;
end $$;
revoke execute on function public.toggle_milestone(uuid, boolean) from public, anon;
grant execute on function public.toggle_milestone(uuid, boolean) to authenticated;

drop policy if exists "updates: project members" on public.project_updates;
create policy "updates: project members" on public.project_updates for select to authenticated
  using (public.in_project(idea_id));
drop policy if exists "updates: project members post" on public.project_updates;
create policy "updates: project members post" on public.project_updates for insert to authenticated
  with check (author_id = auth.uid() and public.in_project(idea_id));

drop trigger if exists milestones_audit on public.milestones;
create trigger milestones_audit after insert or update or delete on public.milestones for each row execute function public.write_audit();
drop trigger if exists project_updates_audit on public.project_updates;
create trigger project_updates_audit after insert on public.project_updates for each row execute function public.write_audit();

-- Tell the other side when someone posts an update
create or replace function public.notify_project_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare i public.ideas; r record;
begin
  select * into i from public.ideas where id = new.idea_id;
  for r in
    select i.owner_id uid union select evaluator_id from public.assignments where idea_id = new.idea_id
    union select id from public.profiles where role = 'adjudicator'
  loop
    if r.uid <> new.author_id then perform public.notify(r.uid, i.id, 'Project update on ' || i.ref, left(new.body, 140)); end if;
  end loop;
  return null;
end $$;
drop trigger if exists project_updates_notify on public.project_updates;
create trigger project_updates_notify after insert on public.project_updates for each row execute function public.notify_project_update();
