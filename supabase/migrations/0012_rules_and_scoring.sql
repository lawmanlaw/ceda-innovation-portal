-- Aligns the portal with the hackathon rules and evaluation form:
-- 1. CEDA's six evaluation categories, scored 1 (Poor) to 5 (Excellent) with comments
-- 2. Innovators confirm the idea is theirs (or their team's) to submit
-- 3. Uploads refused by the file safety check are written to the audit trail

-- 1. Evaluation categories. Old criteria stay for history but are no longer used.
update public.criteria set active = false where active;
insert into public.criteria (name, description, weight, max_score, sort) values
  ('Strategic alignment', 'Supports CEDA''s mission and Botswana''s Vision 2036.', 1, 5, 110),
  ('Innovation and originality', 'A significant improvement or a new concept, using emerging technology.', 1, 5, 120),
  ('Impact potential', 'Job creation, youth and women empowerment, and environmental sustainability.', 1, 5, 130),
  ('Feasibility and viability', 'Technically sound, with the resources available.', 1, 5, 140),
  ('Scalability and sustainability', 'Replicable, financially sustainable, with clear growth plans.', 1, 5, 150),
  ('Implementation capacity', 'Team capability and governance: relevant experience and leadership.', 1, 5, 160);

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
      if p_final then raise exception 'Score every category before submitting (%)', c.name using errcode = '22023'; end if;
      continue;
    end if;
    val := (s ->> 'score')::int;
    if val < 1 or val > c.max_score then
      raise exception '% must be between 1 and %', c.name, c.max_score using errcode = '22023';
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

-- 2. Ownership declaration, recorded with the submission
alter table public.ideas add column if not exists ip_confirmed_at timestamptz;

drop function if exists public.submit_draft(uuid);
create or replace function public.submit_draft(p_idea uuid, p_ip_confirmed boolean)
returns public.ideas
language plpgsql security definer set search_path = public
as $$
declare i public.ideas;
begin
  select * into i from public.ideas where id = p_idea and owner_id = auth.uid() for update;
  if i.id is null then raise exception 'Not found' using errcode = 'P0002'; end if;
  if i.stage <> 'draft' then raise exception 'This idea has already been submitted' using errcode = '42501'; end if;
  if char_length(btrim(i.title)) < 5 then raise exception 'Give your idea a title of at least 5 characters.' using errcode = '22023'; end if;
  if char_length(btrim(i.summary)) < 20 then raise exception 'The summary needs at least 20 characters.' using errcode = '22023'; end if;
  if i.category_id is null then raise exception 'Choose a category.' using errcode = '22023'; end if;
  if not exists (select 1 from public.districts where name = i.district) then
    raise exception 'Choose a district from the list.' using errcode = '22023';
  end if;
  if not coalesce(p_ip_confirmed, false) then
    raise exception 'Confirm that this idea is yours (or your team''s) to submit (IP declaration).' using errcode = '22023';
  end if;
  perform public.validate_answers(i.answers);
  update public.ideas
     set stage = 'submitted', title = btrim(title), summary = btrim(summary),
         ref = 'CEDA-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.idea_ref_seq')::text, 4, '0'),
         version = 1, submitted_at = now(), stage_changed_at = now(), updated_at = now(),
         ip_confirmed_at = now()
   where id = p_idea
   returning * into i;
  insert into public.idea_versions (idea_id, version, snapshot, created_by) values (i.id, 1, to_jsonb(i), auth.uid());
  insert into public.stage_history (idea_id, from_stage, to_stage, actor_id, note)
  values (i.id, 'draft', 'submitted', auth.uid(), 'Thank you. We will let you know when review starts.');
  return i;
end $$;
revoke execute on function public.submit_draft(uuid, boolean) from public, anon;
grant execute on function public.submit_draft(uuid, boolean) to authenticated;

-- 3. Blocked uploads go on the audit trail so admins can see attempted malicious files
create or replace function public.log_blocked_upload(p_idea uuid, p_file text, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.ideas where id = p_idea and owner_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, record_id, new_data)
  values (auth.uid(), 'upload_blocked', 'attachments', p_idea::text,
          jsonb_build_object('file', left(p_file, 200), 'reason', left(p_reason, 300)));
end $$;
revoke execute on function public.log_blocked_upload(uuid, text, text) from public, anon;
grant execute on function public.log_blocked_upload(uuid, text, text) to authenticated;

-- WEBP images allowed alongside PNG and JPG
update storage.buckets set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
where id = 'idea-files';
