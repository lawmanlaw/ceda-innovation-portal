-- Innovators can delete one of their own ideas outright, at any stage.
-- Files, versions, history, scores, feedback, next steps and updates go with it; the audit log keeps the record.
create or replace function public.delete_my_idea(p_idea uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); r text;
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select ref into r from public.ideas where id = p_idea and owner_id = me;
  if not found then raise exception 'Idea not found' using errcode = '42501'; end if;
  insert into public.audit_log (actor_id, action, table_name, record_id) values (me, 'idea_deleted:' || coalesce(r, ''), 'ideas', p_idea::text);
  delete from public.ideas where id = p_idea and owner_id = me;
end $$;
revoke execute on function public.delete_my_idea(uuid) from public, anon;
grant execute on function public.delete_my_idea(uuid) to authenticated;
