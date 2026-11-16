-- Innovators can delete their own account (Data Protection Act, 2024: erasure on request).
-- Staff accounts are removed by an administrator so evaluation records stay accountable.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not public.has_role('submitter') then
    raise exception 'Staff accounts are removed by an administrator' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, table_name, record_id) values (me, 'account_deleted', 'auth.users', me::text);
  delete from public.ideas where owner_id = me;   -- files, versions, history, scores and feedback go with them
  delete from public.chat_threads where user_id = me;   -- messages go with the threads
  delete from public.chat_messages where sender_id = me;
  delete from auth.users where id = me;            -- profile and alerts go with it
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Owners can remove their own files at any stage, so deleting an account leaves nothing behind
drop policy if exists "idea files: owner deletes while editable" on storage.objects;
create policy "idea files: owner deletes own files" on storage.objects for delete to authenticated
  using (
    bucket_id = 'idea-files'
    and exists (select 1 from public.ideas i where i.id = ((storage.foldername(name))[1])::uuid and i.owner_id = auth.uid())
  );

update public.pages set body = replace(body,
  'To get a copy of your data, or to have your account and submissions deleted, ask through live chat or the support contact.',
  'You can delete your account and all your submissions yourself under Profile. To get a copy of your data, ask through live chat or the support contact. The audit trail keeps a record that the account existed and was deleted, as required for accountability.')
where slug = 'privacy';
