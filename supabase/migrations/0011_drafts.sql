-- Drafts: innovators save as they type and submit when ready. Once submitted, an idea is final
-- unless the panel returns it for changes.

-- Drafts may be incomplete; the full rules apply when submitting
alter table public.ideas drop constraint if exists ideas_title_check;
alter table public.ideas drop constraint if exists ideas_summary_check;
alter table public.ideas add constraint ideas_title_check check (stage = 'draft' or char_length(title) between 5 and 150);
alter table public.ideas add constraint ideas_summary_check check (stage = 'draft' or char_length(summary) between 20 and 600);
alter table public.ideas add constraint ideas_draft_size check (char_length(title) <= 150 and char_length(summary) <= 600);

-- Drafts are visible to their owner only
create or replace function public.can_see_idea(p_idea uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.ideas where id = p_idea and owner_id = auth.uid())
      or (exists (select 1 from public.ideas where id = p_idea and stage <> 'draft')
          and (public.has_role('admin', 'adjudicator', 'observer')
               or exists (select 1 from public.assignments where idea_id = p_idea and evaluator_id = auth.uid())))
$$;

create or replace function public.save_draft(p_idea uuid, p_title text, p_summary text, p_category smallint, p_district text, p_answers jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  i public.ideas;
  clean jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not public.has_role('submitter') then raise exception 'Only innovators can draft ideas' using errcode = '42501'; end if;
  select coalesce(jsonb_object_agg(f.key, left(p_answers ->> f.key, f.max_length)), '{}'::jsonb) into clean
  from public.form_fields f where f.active and coalesce(p_answers, '{}'::jsonb) ? f.key;
  if p_idea is null then
    insert into public.ideas (owner_id, title, summary, category_id, district, answers, stage, ref)
    values (auth.uid(), left(coalesce(p_title, ''), 150), left(coalesce(p_summary, ''), 600), p_category,
            left(coalesce(p_district, ''), 60), clean, 'draft', 'DRAFT-' || substr(gen_random_uuid()::text, 1, 8))
    returning * into i;
    return i.id;
  end if;
  update public.ideas
     set title = left(coalesce(p_title, ''), 150), summary = left(coalesce(p_summary, ''), 600), category_id = p_category,
         district = left(coalesce(p_district, ''), 60), answers = clean, updated_at = now()
   where id = p_idea and owner_id = auth.uid() and stage = 'draft'
   returning * into i;
  if i.id is null then
    raise exception 'This idea has already been submitted and can no longer be changed' using errcode = '42501';
  end if;
  return i.id;
end $$;

create or replace function public.submit_draft(p_idea uuid)
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
  perform public.validate_answers(i.answers);
  update public.ideas
     set stage = 'submitted', title = btrim(title), summary = btrim(summary),
         ref = 'CEDA-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.idea_ref_seq')::text, 4, '0'),
         version = 1, submitted_at = now(), stage_changed_at = now(), updated_at = now()
   where id = p_idea
   returning * into i;
  insert into public.idea_versions (idea_id, version, snapshot, created_by) values (i.id, 1, to_jsonb(i), auth.uid());
  insert into public.stage_history (idea_id, from_stage, to_stage, actor_id, note)
  values (i.id, 'draft', 'submitted', auth.uid(), 'Thank you. We will let you know when review starts.');
  return i;
end $$;

create or replace function public.delete_draft(p_idea uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.ideas where id = p_idea and owner_id = auth.uid() and stage = 'draft';
  if not found then raise exception 'Only drafts can be deleted' using errcode = '42501'; end if;
end $$;

revoke execute on function public.save_draft(uuid, text, text, smallint, text, jsonb), public.submit_draft(uuid), public.delete_draft(uuid) from public, anon;
grant execute on function public.save_draft(uuid, text, text, smallint, text, jsonb), public.submit_draft(uuid), public.delete_draft(uuid) to authenticated;

-- Submitted ideas are final: no withdrawing drafts, no evaluators on drafts
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
  return new;
end $$;

-- Files can be added or removed only while drafting, or when the panel asks for changes
drop policy if exists "owner adds attachments" on public.attachments;
drop policy if exists "owner removes attachments" on public.attachments;
create policy "owner adds attachments" on public.attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (
    select 1 from public.ideas where id = idea_id and owner_id = auth.uid() and stage in ('draft', 'feedback')));
create policy "owner removes attachments" on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() and exists (
    select 1 from public.ideas where id = idea_id and owner_id = auth.uid() and stage in ('draft', 'feedback')));
drop policy if exists "idea files: owner uploads while editable" on storage.objects;
drop policy if exists "idea files: owner deletes own files" on storage.objects;
create policy "idea files: owner uploads while editable" on storage.objects for insert to authenticated
  with check (bucket_id = 'idea-files' and exists (select 1 from public.ideas i
    where i.id = ((storage.foldername(name))[1])::uuid and i.owner_id = auth.uid() and i.stage in ('draft', 'feedback')));
create policy "idea files: owner deletes while editable" on storage.objects for delete to authenticated
  using (bucket_id = 'idea-files' and exists (select 1 from public.ideas i
    where i.id = ((storage.foldername(name))[1])::uuid and i.owner_id = auth.uid() and i.stage in ('draft', 'feedback')));

create or replace function public.write_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rec_id text;
begin
  -- Draft autosaves are private to the innovator and not audited; the submission itself is
  if tg_table_name = 'ideas' then
    if tg_op = 'DELETE' then
      if old.stage = 'draft' then return null; end if;
    elsif new.stage = 'draft' then
      return null;
    end if;
  end if;
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
      from (select * from public.ideas where stage <> 'draft') ideas),
    'by_stage', (select coalesce(jsonb_object_agg(stage, n), '{}') from (select stage, count(*) n from (select * from public.ideas where stage <> 'draft') ideas group by stage) x),
    'by_district', (select coalesce(jsonb_object_agg(district, n), '{}') from (select district, count(*) n from (select * from public.ideas where stage <> 'draft') ideas group by district) x),
    'by_category', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(c.name, 'Uncategorised'), 'n', x.n) order by x.n desc), '[]')
                    from (select category_id, count(*) n from (select * from public.ideas where stage <> 'draft') ideas group by category_id) x
                    left join public.categories c on c.id = x.category_id),
    'by_week', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'n', n) order by w), '[]')
                from (select to_char(date_trunc('week', submitted_at), 'YYYY-MM-DD') w, count(*) n
                      from (select * from public.ideas where stage <> 'draft') ideas where submitted_at > now() - interval '12 weeks' group by 1) x),
    'avg_days_to_decision', (select round(avg(extract(epoch from (h.created_at - i.submitted_at)) / 86400)::numeric, 1)
                             from public.stage_history h join public.ideas i on i.id = h.idea_id and i.stage <> 'draft'
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
