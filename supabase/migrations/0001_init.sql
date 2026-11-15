-- CEDA Innovation Portal: core schema
-- Every permission lives in the database (row level security), not only in the app.
-- Stage changes go through security-definer functions so the workflow can't be skipped.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('submitter', 'evaluator', 'adjudicator', 'admin', 'agent');
create type public.idea_stage as enum ('submitted', 'in_review', 'feedback', 'approved', 'awarded', 'rejected', 'withdrawn');

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.districts (
  id smallserial primary key,
  name text not null unique
);

create table public.categories (
  id smallserial primary key,
  name text not null unique,
  active boolean not null default true
);

create table public.public_holidays (
  day date primary key,
  name text not null
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  organisation text,
  district text,
  role public.app_role not null default 'submitter',
  alerts_email boolean not null default true,
  alerts_in_app boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Role lookup used by every policy. security definer so policies on profiles don't recurse.
create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.has_role(variadic roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role = any(roles) from public.profiles where id = auth.uid()), false) $$;

-- New account -> profile. Role is never taken from client metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name, organisation, district)
  values (
    new.id,
    new.email,
    new.phone,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    left(new.raw_user_meta_data ->> 'organisation', 120),
    left(new.raw_user_meta_data ->> 'district', 60)
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Only admins may change a role. Blocks privilege escalation through the profile form.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() is null only for trusted server contexts (SQL editor, service role)
  if auth.uid() is null then
    new.updated_at := now();
    return new;
  end if;
  if new.role is distinct from old.role and not public.has_role('admin') then
    raise exception 'Only administrators can change roles' using errcode = '42501';
  end if;
  if new.id <> old.id or new.email is distinct from old.email then
    raise exception 'Identity fields cannot be changed here' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_guard
before update on public.profiles
for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Configurable application form (admins add, edit or retire questions)
-- ---------------------------------------------------------------------------
create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null,
  help text,
  kind text not null default 'textarea' check (kind in ('text', 'textarea', 'select', 'number', 'url')),
  options jsonb,
  required boolean not null default true,
  max_length int not null default 2000,
  sort int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Downloadable templates and guides admins publish (stored in the public "documents" bucket)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  storage_path text not null,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ideas and workflow
-- ---------------------------------------------------------------------------
create sequence public.idea_ref_seq;

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('CEDA-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.idea_ref_seq')::text, 4, '0')),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (char_length(title) between 5 and 150),
  summary text not null check (char_length(summary) between 20 and 600),
  category_id smallint references public.categories (id),
  district text not null,
  answers jsonb not null default '{}'::jsonb,
  stage public.idea_stage not null default 'submitted',
  version int not null default 1,
  submitted_at timestamptz not null default now(),
  stage_changed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ideas_owner_idx on public.ideas (owner_id);
create index ideas_stage_idx on public.ideas (stage);

create table public.idea_versions (
  id bigserial primary key,
  idea_id uuid not null references public.ideas (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (idea_id, version)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  size_bytes int not null check (size_bytes <= 10485760),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index attachments_idea_idx on public.attachments (idea_id);

create table public.stage_history (
  id bigserial primary key,
  idea_id uuid not null references public.ideas (id) on delete cascade,
  from_stage public.idea_stage,
  to_stage public.idea_stage not null,
  actor_id uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);
create index stage_history_idea_idx on public.stage_history (idea_id);

-- Evaluation criteria CEDA can change at any time
create table public.criteria (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  weight numeric(5,2) not null default 1 check (weight > 0),
  max_score int not null default 10 check (max_score between 1 and 100),
  active boolean not null default true,
  sort int not null default 0
);

create table public.assignments (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  evaluator_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (idea_id, evaluator_id)
);
create index assignments_evaluator_idx on public.assignments (evaluator_id);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  evaluator_id uuid not null references public.profiles (id) on delete cascade,
  criterion_id uuid not null references public.criteria (id) on delete restrict,
  score int not null check (score >= 0),
  comment text check (char_length(comment) <= 1000),
  updated_at timestamptz not null default now(),
  unique (idea_id, evaluator_id, criterion_id)
);
create index scores_idea_idx on public.scores (idea_id);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 4000),
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index feedback_idea_idx on public.feedback (idea_id);

create table public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  idea_id uuid references public.ideas (id) on delete cascade,
  title text not null,
  body text,
  emailed boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Help: FAQs, regulatory contacts, editable pages
-- ---------------------------------------------------------------------------
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  topic text not null default 'General',
  sort int not null default 0,
  published boolean not null default true
);

create table public.authorities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  remit text,
  phone text,
  email text,
  website text,
  sort int not null default 0
);

create table public.pages (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  title text not null,
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Live chat
-- ---------------------------------------------------------------------------
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  agent_id uuid references public.profiles (id),
  idea_id uuid references public.ideas (id) on delete set null,
  topic text,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'closed', 'missed')),
  opened_outside_hours boolean not null default false,
  created_at timestamptz not null default now(),
  first_reply_at timestamptz,
  closed_at timestamptz,
  rating smallint check (rating between 1 and 5)
);
create index chat_threads_user_idx on public.chat_threads (user_id);
create index chat_threads_status_idx on public.chat_threads (status);

create table public.chat_messages (
  id bigserial primary key,
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid references public.profiles (id),
  body text not null check (char_length(body) between 1 and 2000),
  system boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx on public.chat_messages (thread_id, id);

create table public.agent_presence (
  agent_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen timestamptz not null default now()
);

-- Chat opens 09:00 to 16:00 Gaborone time, Monday to Friday, except public holidays
create or replace function public.chat_is_open(at timestamptz default now())
returns boolean
language sql stable set search_path = public
as $$
  select extract(isodow from at at time zone 'Africa/Gaborone') between 1 and 5
     and (at at time zone 'Africa/Gaborone')::time >= time '09:00'
     and (at at time zone 'Africa/Gaborone')::time < time '16:00'
     and not exists (select 1 from public.public_holidays where day = (at at time zone 'Africa/Gaborone')::date)
$$;

create or replace function public.agents_online()
returns int
language sql stable security definer set search_path = public
as $$ select count(*)::int from public.agent_presence where last_seen > now() - interval '2 minutes' $$;

-- ---------------------------------------------------------------------------
-- Audit trail: append only, written by trigger, readable by admins only
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id);

create or replace function public.write_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rec_id text;
begin
  rec_id := coalesce(
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'idea_id',
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'slug'
  );
  insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    rec_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

create or replace function public.block_audit_changes()
returns trigger language plpgsql as $$
begin
  raise exception 'The audit log is append only' using errcode = '42501';
end $$;

create trigger audit_log_immutable
before update or delete on public.audit_log
for each row execute function public.block_audit_changes();

do $$
declare t text;
begin
  foreach t in array array['profiles','ideas','attachments','criteria','assignments','scores','feedback',
                           'form_fields','documents','faqs','authorities','pages','categories','chat_threads']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.write_audit()', t || '_audit', t);
  end loop;
end $$;

-- Sign-ins are audited from the auth schema
create or replace function public.audit_sign_in()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    insert into public.audit_log (actor_id, action, table_name, record_id)
    values (new.id, 'sign_in', 'auth.users', new.id::text);
  end if;
  return new;
end $$;

create trigger on_auth_user_sign_in
after update of last_sign_in_at on auth.users
for each row execute function public.audit_sign_in();

-- ---------------------------------------------------------------------------
-- Notifications: written by triggers, respecting each user's alert settings
-- ---------------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_idea uuid, p_title text, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = p_user and (alerts_in_app or alerts_email)) then
    insert into public.notifications (user_id, idea_id, title, body) values (p_user, p_idea, p_title, p_body);
  end if;
end $$;

create or replace function public.on_stage_history()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  i public.ideas;
  label text;
begin
  select * into i from public.ideas where id = new.idea_id;
  label := case new.to_stage
    when 'submitted' then 'received'
    when 'in_review' then 'now under review'
    when 'feedback' then 'returned with feedback'
    when 'approved' then 'approved'
    when 'awarded' then 'awarded'
    when 'rejected' then 'not taken forward'
    when 'withdrawn' then 'withdrawn'
  end;
  perform public.notify(i.owner_id, i.id, i.ref || ' ' || label, new.note);
  return null;
end $$;

create trigger stage_history_notify
after insert on public.stage_history
for each row execute function public.on_stage_history();

create or replace function public.on_feedback()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  i public.ideas;
begin
  select * into i from public.ideas where id = new.idea_id;
  if not new.internal and new.author_id <> i.owner_id then
    perform public.notify(i.owner_id, i.id, 'New feedback on ' || i.ref, left(new.body, 140));
  end if;
  return null;
end $$;

create trigger feedback_notify
after insert on public.feedback
for each row execute function public.on_feedback();

-- ---------------------------------------------------------------------------
-- Workflow functions (the only way an idea changes stage or content)
-- ---------------------------------------------------------------------------
create or replace function public.validate_answers(p_answers jsonb)
returns void
language plpgsql stable security definer set search_path = public
as $$
declare
  f public.form_fields;
  v text;
begin
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Answers must be an object';
  end if;
  for f in select * from public.form_fields where active loop
    v := btrim(coalesce(p_answers ->> f.key, ''));
    if f.required and v = '' then
      raise exception 'Please answer: %', f.label using errcode = '22023';
    end if;
    if char_length(v) > f.max_length then
      raise exception '% is too long (max % characters)', f.label, f.max_length using errcode = '22023';
    end if;
  end loop;
end $$;

create or replace function public.submit_idea(
  p_title text, p_summary text, p_category smallint, p_district text, p_answers jsonb
) returns public.ideas
language plpgsql security definer set search_path = public
as $$
declare
  i public.ideas;
  clean jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.districts where name = p_district) then
    raise exception 'Choose a district from the list' using errcode = '22023';
  end if;
  -- keep only keys the form actually asks for
  select coalesce(jsonb_object_agg(f.key, btrim(p_answers ->> f.key)), '{}'::jsonb) into clean
  from public.form_fields f where f.active and p_answers ? f.key;
  perform public.validate_answers(clean);

  insert into public.ideas (owner_id, title, summary, category_id, district, answers)
  values (auth.uid(), btrim(p_title), btrim(p_summary), p_category, p_district, clean)
  returning * into i;

  insert into public.idea_versions (idea_id, version, snapshot, created_by)
  values (i.id, 1, to_jsonb(i), auth.uid());
  insert into public.stage_history (idea_id, from_stage, to_stage, actor_id, note)
  values (i.id, null, 'submitted', auth.uid(), 'Thank you. We will let you know when review starts.');
  return i;
end $$;

-- Submitter edits and resubmits after feedback
create or replace function public.resubmit_idea(
  p_idea uuid, p_title text, p_summary text, p_category smallint, p_district text, p_answers jsonb, p_note text
) returns public.ideas
language plpgsql security definer set search_path = public
as $$
declare
  i public.ideas;
  clean jsonb;
begin
  select * into i from public.ideas where id = p_idea for update;
  if i.id is null or i.owner_id <> auth.uid() then raise exception 'Not found' using errcode = 'P0002'; end if;
  if i.stage <> 'feedback' then
    raise exception 'This idea can only be changed after evaluators return it with feedback' using errcode = '42501';
  end if;
  if not exists (select 1 from public.districts where name = p_district) then
    raise exception 'Choose a district from the list' using errcode = '22023';
  end if;
  select coalesce(jsonb_object_agg(f.key, btrim(p_answers ->> f.key)), '{}'::jsonb) into clean
  from public.form_fields f where f.active and p_answers ? f.key;
  perform public.validate_answers(clean);

  update public.ideas
     set title = btrim(p_title), summary = btrim(p_summary), category_id = p_category, district = p_district,
         answers = clean, version = version + 1, stage = 'in_review', stage_changed_at = now(), updated_at = now()
   where id = p_idea
   returning * into i;

  insert into public.idea_versions (idea_id, version, snapshot, created_by) values (i.id, i.version, to_jsonb(i), auth.uid());
  -- evaluators score the new version from scratch
  update public.assignments set submitted_at = null where idea_id = i.id;
  insert into public.stage_history (idea_id, from_stage, to_stage, actor_id, note)
  values (i.id, 'feedback', 'in_review', auth.uid(), coalesce(nullif(btrim(p_note), ''), 'Resubmitted as version ' || i.version));
  return i;
end $$;

create or replace function public.withdraw_idea(p_idea uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare i public.ideas;
begin
  select * into i from public.ideas where id = p_idea for update;
  if i.id is null or i.owner_id <> auth.uid() then raise exception 'Not found' using errcode = 'P0002'; end if;
  if i.stage in ('approved', 'awarded', 'rejected', 'withdrawn') then
    raise exception 'This idea can no longer be withdrawn' using errcode = '42501';
  end if;
  update public.ideas set stage = 'withdrawn', stage_changed_at = now(), updated_at = now() where id = p_idea;
  insert into public.stage_history (idea_id, from_stage, to_stage, actor_id) values (p_idea, i.stage, 'withdrawn', auth.uid());
end $$;

-- Staff stage moves, with the allowed transitions spelled out
create or replace function public.move_idea(p_idea uuid, p_to public.idea_stage, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  i public.ideas;
  r public.app_role := public.my_role();
  ok boolean := false;
begin
  select * into i from public.ideas where id = p_idea for update;
  if i.id is null then raise exception 'Not found' using errcode = 'P0002'; end if;

  ok := case
    -- admins and adjudicators open review once evaluators are assigned
    when i.stage = 'submitted' and p_to = 'in_review' then r in ('admin', 'adjudicator')
    when i.stage = 'submitted' and p_to = 'rejected' then r in ('admin', 'adjudicator')
    -- adjudication after scoring
    when i.stage = 'in_review' and p_to in ('feedback', 'approved', 'rejected') then r in ('admin', 'adjudicator')
    when i.stage = 'approved' and p_to = 'awarded' then r in ('admin', 'adjudicator')
    else false
  end;
  if not ok then
    raise exception 'You cannot move % from % to %', i.ref, i.stage, p_to using errcode = '42501';
  end if;
  if p_to = 'in_review' and not exists (select 1 from public.assignments where idea_id = p_idea) then
    raise exception 'Assign at least one evaluator first' using errcode = '22023';
  end if;
  if p_to in ('feedback', 'rejected') and coalesce(btrim(p_note), '') = '' then
    raise exception 'Add a note so the submitter knows why' using errcode = '22023';
  end if;

  update public.ideas set stage = p_to, stage_changed_at = now(), updated_at = now() where id = p_idea;
  insert into public.stage_history (idea_id, from_stage, to_stage, actor_id, note)
  values (p_idea, i.stage, p_to, auth.uid(), nullif(btrim(p_note), ''));
  if p_to = 'feedback' then
    insert into public.feedback (idea_id, author_id, body) values (p_idea, auth.uid(), btrim(p_note));
  end if;
end $$;

create or replace function public.assign_evaluator(p_idea uuid, p_evaluator uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role('admin', 'adjudicator') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_evaluator and role = 'evaluator') then
    raise exception 'That person is not an evaluator' using errcode = '22023';
  end if;
  insert into public.assignments (idea_id, evaluator_id, assigned_by) values (p_idea, p_evaluator, auth.uid())
  on conflict do nothing;
  perform public.notify(p_evaluator, p_idea, 'New idea to evaluate', (select ref || ': ' || title from public.ideas where id = p_idea));
end $$;

create or replace function public.unassign_evaluator(p_idea uuid, p_evaluator uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role('admin', 'adjudicator') then raise exception 'Not allowed' using errcode = '42501'; end if;
  delete from public.assignments where idea_id = p_idea and evaluator_id = p_evaluator;
  delete from public.scores where idea_id = p_idea and evaluator_id = p_evaluator;
end $$;

-- Evaluator saves all criterion scores at once; final=true locks their scoring
create or replace function public.save_scores(p_idea uuid, p_scores jsonb, p_final boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a public.assignments;
  c public.criteria;
  s jsonb;
  val int;
begin
  select * into a from public.assignments where idea_id = p_idea and evaluator_id = auth.uid();
  if a.idea_id is null then raise exception 'You are not assigned to this idea' using errcode = '42501'; end if;
  if (select stage from public.ideas where id = p_idea) <> 'in_review' then
    raise exception 'Scoring is closed for this idea' using errcode = '42501';
  end if;
  if a.submitted_at is not null then raise exception 'You already submitted your scores' using errcode = '42501'; end if;

  for c in select * from public.criteria where active loop
    s := p_scores -> c.id::text;
    if s is null or s ->> 'score' is null then
      if p_final then raise exception 'Score every criterion before submitting (%)', c.name using errcode = '22023'; end if;
      continue;
    end if;
    val := (s ->> 'score')::int;
    if val < 0 or val > c.max_score then
      raise exception '% must be between 0 and %', c.name, c.max_score using errcode = '22023';
    end if;
    insert into public.scores (idea_id, evaluator_id, criterion_id, score, comment)
    values (p_idea, auth.uid(), c.id, val, left(nullif(btrim(s ->> 'comment'), ''), 1000))
    on conflict (idea_id, evaluator_id, criterion_id)
    do update set score = excluded.score, comment = excluded.comment, updated_at = now();
  end loop;

  if p_final then
    update public.assignments set submitted_at = now() where idea_id = p_idea and evaluator_id = auth.uid();
  end if;
end $$;

-- Weighted result per idea, as a percentage. Adjudicators and admins only.
create or replace function public.idea_results(p_idea uuid)
returns table (criterion text, weight numeric, max_score int, average numeric, evaluators int)
language sql stable security definer set search_path = public
as $$
  select c.name, c.weight, c.max_score, round(avg(s.score)::numeric, 2), count(s.*)::int
  from public.criteria c
  left join public.scores s on s.criterion_id = c.id and s.idea_id = p_idea
  where public.has_role('admin', 'adjudicator') and (c.active or s.id is not null)
  group by c.id order by c.sort
$$;

create or replace function public.idea_score_pct(p_idea uuid)
returns numeric
language sql stable security definer set search_path = public
as $$
  select round(100 * sum(c.weight * s.score::numeric / c.max_score) / nullif(sum(c.weight), 0), 1)
  from public.scores s join public.criteria c on c.id = s.criterion_id
  where s.idea_id = p_idea and public.has_role('admin', 'adjudicator')
$$;

-- ---------------------------------------------------------------------------
-- Reporting (admins and adjudicators)
-- ---------------------------------------------------------------------------
create or replace function public.report_overview()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare out jsonb;
begin
  if not public.has_role('admin', 'adjudicator') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'ideas', count(*),
        'submitters', count(distinct owner_id),
        'this_month', count(*) filter (where submitted_at >= date_trunc('month', now())),
        'awarded', count(*) filter (where stage = 'awarded'))
      from public.ideas),
    'by_stage', (select coalesce(jsonb_object_agg(stage, n), '{}') from (select stage, count(*) n from public.ideas group by stage) x),
    'by_district', (select coalesce(jsonb_object_agg(district, n), '{}') from (select district, count(*) n from public.ideas group by district) x),
    'by_category', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(c.name, 'Uncategorised'), 'n', x.n) order by x.n desc), '[]')
                    from (select category_id, count(*) n from public.ideas group by category_id) x
                    left join public.categories c on c.id = x.category_id),
    'by_week', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'n', n) order by w), '[]')
                from (select to_char(date_trunc('week', submitted_at), 'YYYY-MM-DD') w, count(*) n
                      from public.ideas where submitted_at > now() - interval '12 weeks' group by 1) x),
    'avg_days_to_decision', (select round(avg(extract(epoch from (h.created_at - i.submitted_at)) / 86400)::numeric, 1)
                             from public.stage_history h join public.ideas i on i.id = h.idea_id
                             where h.to_stage in ('approved', 'rejected')),
    'evaluator_load', (select coalesce(jsonb_agg(jsonb_build_object('name', p.full_name, 'assigned', x.a, 'done', x.d) order by x.a desc), '[]')
                       from (select evaluator_id, count(*) a, count(submitted_at) d from public.assignments group by evaluator_id) x
                       join public.profiles p on p.id = x.evaluator_id),
    'chat', (select jsonb_build_object(
        'threads', count(*),
        'missed', count(*) filter (where status = 'missed' or opened_outside_hours),
        'avg_first_reply_min', round(avg(extract(epoch from (first_reply_at - created_at)) / 60)::numeric, 1),
        'avg_rating', round(avg(rating)::numeric, 1))
      from public.chat_threads)
  ) into out;
  return out;
end $$;

-- ---------------------------------------------------------------------------
-- Chat functions
-- ---------------------------------------------------------------------------
create or replace function public.open_chat(p_topic text, p_message text, p_idea uuid default null)
returns public.chat_threads
language plpgsql security definer set search_path = public
as $$
declare
  t public.chat_threads;
  open_now boolean := public.chat_is_open();
  online int := public.agents_online();
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_idea is not null and not exists (select 1 from public.ideas where id = p_idea and owner_id = auth.uid()) then
    p_idea := null;
  end if;
  insert into public.chat_threads (user_id, idea_id, topic, opened_outside_hours, status)
  values (auth.uid(), p_idea, left(p_topic, 120), not open_now, case when open_now then 'waiting' else 'missed' end)
  returning * into t;
  insert into public.chat_messages (thread_id, sender_id, body) values (t.id, auth.uid(), left(btrim(p_message), 2000));
  insert into public.chat_messages (thread_id, body, system) values (t.id,
    case
      when not open_now then 'Our consultants are available 09:00 to 16:00, Monday to Friday. We have saved your message and will reply on the next working day.'
      when online = 0 then 'No consultant is available at the moment. Please stay on this page or check back later; your message is saved.'
      else 'Thanks. A CEDA consultant will be with you shortly.'
    end, true);
  return t;
end $$;

create or replace function public.claim_chat(p_thread uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role('agent', 'admin') then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.chat_threads set agent_id = auth.uid(), status = 'active'
  where id = p_thread and status in ('waiting', 'missed') and agent_id is null;
  if not found then raise exception 'Another consultant already took this chat' using errcode = '40001'; end if;
  insert into public.chat_messages (thread_id, body, system)
  values (p_thread, (select coalesce(nullif(full_name, ''), 'A consultant') from public.profiles where id = auth.uid()) || ' joined the chat', true);
end $$;

create or replace function public.close_chat(p_thread uuid, p_rating smallint default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare t public.chat_threads;
begin
  select * into t from public.chat_threads where id = p_thread;
  if t.id is null or not (t.user_id = auth.uid() or t.agent_id = auth.uid() or public.has_role('admin')) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  update public.chat_threads
     set status = 'closed', closed_at = coalesce(closed_at, now()),
         rating = case when t.user_id = auth.uid() then coalesce(p_rating, rating) else rating end
   where id = p_thread;
end $$;

create or replace function public.on_chat_message()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not new.system then
    update public.chat_threads set first_reply_at = coalesce(first_reply_at, now())
    where id = new.thread_id and agent_id = new.sender_id;
  end if;
  return null;
end $$;

create trigger chat_message_after
after insert on public.chat_messages
for each row execute function public.on_chat_message();

create or replace function public.agent_heartbeat()
returns void
language sql security definer set search_path = public
as $$
  insert into public.agent_presence (agent_id) select auth.uid() where public.has_role('agent', 'admin')
  on conflict (agent_id) do update set last_seen = now()
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.districts enable row level security;
alter table public.categories enable row level security;
alter table public.public_holidays enable row level security;
alter table public.profiles enable row level security;
alter table public.form_fields enable row level security;
alter table public.documents enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_versions enable row level security;
alter table public.attachments enable row level security;
alter table public.stage_history enable row level security;
alter table public.criteria enable row level security;
alter table public.assignments enable row level security;
alter table public.scores enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.faqs enable row level security;
alter table public.authorities enable row level security;
alter table public.pages enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.agent_presence enable row level security;
alter table public.audit_log enable row level security;

-- Who can see an idea: owner, assigned evaluators, adjudicators, admins
create or replace function public.can_see_idea(p_idea uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.ideas where id = p_idea and owner_id = auth.uid())
      or public.has_role('admin', 'adjudicator')
      or exists (select 1 from public.assignments where idea_id = p_idea and evaluator_id = auth.uid())
$$;

-- Public reference content
create policy "read districts" on public.districts for select using (true);
create policy "read categories" on public.categories for select using (active or public.has_role('admin'));
create policy "read holidays" on public.public_holidays for select using (true);
create policy "read form" on public.form_fields for select using (active or public.has_role('admin'));
create policy "read documents" on public.documents for select using (published or public.has_role('admin'));
create policy "read faqs" on public.faqs for select using (published or public.has_role('admin'));
create policy "read authorities" on public.authorities for select using (true);
create policy "read pages" on public.pages for select using (true);
create policy "read criteria" on public.criteria for select to authenticated using (true);

-- Admin manages content
create policy "admin categories" on public.categories for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "admin holidays" on public.public_holidays for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "admin form" on public.form_fields for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "admin documents" on public.documents for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "admin faqs" on public.faqs for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "admin authorities" on public.authorities for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "admin pages" on public.pages for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "admin criteria" on public.criteria for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- Profiles: yourself, or staff who need names (admins see all; adjudicators see evaluators and submitters of ideas)
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "staff read profiles" on public.profiles for select to authenticated
  using (public.has_role('admin', 'adjudicator', 'agent'));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "admin update profiles" on public.profiles for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Ideas: read only. All writes go through the workflow functions above.
create policy "see ideas" on public.ideas for select to authenticated using (public.can_see_idea(id));
create policy "see versions" on public.idea_versions for select to authenticated using (public.can_see_idea(idea_id));
create policy "see history" on public.stage_history for select to authenticated using (public.can_see_idea(idea_id));

create policy "see attachments" on public.attachments for select to authenticated using (public.can_see_idea(idea_id));
create policy "owner adds attachments" on public.attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (
    select 1 from public.ideas where id = idea_id and owner_id = auth.uid() and stage in ('submitted', 'feedback')));
create policy "owner removes attachments" on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() and exists (
    select 1 from public.ideas where id = idea_id and owner_id = auth.uid() and stage in ('submitted', 'feedback')));

-- Assignments: evaluators see their own, adjudicators and admins see all
create policy "see assignments" on public.assignments for select to authenticated
  using (evaluator_id = auth.uid() or public.has_role('admin', 'adjudicator'));

-- Scores: each evaluator sees only their own; adjudicators and admins see everything. Writes via save_scores().
create policy "see scores" on public.scores for select to authenticated
  using (evaluator_id = auth.uid() or public.has_role('admin', 'adjudicator'));

-- Feedback: submitters see what is meant for them and can reply; internal notes stay with staff
create policy "see feedback" on public.feedback for select to authenticated
  using (public.can_see_idea(idea_id) and (not internal or public.has_role('admin', 'adjudicator', 'evaluator')));
create policy "post feedback" on public.feedback for insert to authenticated
  with check (
    author_id = auth.uid() and public.can_see_idea(idea_id)
    and (not internal or public.has_role('admin', 'adjudicator', 'evaluator'))
    and exists (select 1 from public.ideas where id = idea_id and stage not in ('withdrawn', 'rejected', 'awarded'))
  );

-- Notifications: your own only
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Chat
create policy "see threads" on public.chat_threads for select to authenticated
  using (user_id = auth.uid() or public.has_role('agent', 'admin'));
create policy "see messages" on public.chat_messages for select to authenticated
  using (exists (select 1 from public.chat_threads t where t.id = thread_id and (t.user_id = auth.uid() or public.has_role('agent', 'admin'))));
create policy "send messages" on public.chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid() and not system
    and exists (select 1 from public.chat_threads t where t.id = thread_id and t.status <> 'closed'
                and (t.user_id = auth.uid() or t.agent_id = auth.uid()))
  );
create policy "see presence" on public.agent_presence for select to authenticated using (public.has_role('agent', 'admin'));

-- Audit log: admins read, nobody writes directly
create policy "admin reads audit" on public.audit_log for select to authenticated using (public.has_role('admin'));

-- Workflow tables have no insert/update/delete policies on purpose:
-- ideas, idea_versions, stage_history, assignments, scores are changed only by the functions above.

-- Function access: nothing for anonymous visitors
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.my_role(), public.has_role(public.app_role[]), public.can_see_idea(uuid),
  public.submit_idea(text, text, smallint, text, jsonb),
  public.resubmit_idea(uuid, text, text, smallint, text, jsonb, text),
  public.withdraw_idea(uuid), public.move_idea(uuid, public.idea_stage, text),
  public.assign_evaluator(uuid, uuid), public.unassign_evaluator(uuid, uuid),
  public.save_scores(uuid, jsonb, boolean), public.idea_results(uuid), public.idea_score_pct(uuid),
  public.report_overview(), public.open_chat(text, text, uuid), public.claim_chat(uuid),
  public.close_chat(uuid, smallint), public.agent_heartbeat(), public.agents_online()
to authenticated;
grant execute on function public.chat_is_open(timestamptz), public.has_role(public.app_role[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: status changes, notifications and chat update live
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.chat_messages, public.chat_threads, public.ideas;
  end if;
end $$;
