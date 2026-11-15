-- Files: private bucket for idea attachments, public bucket for templates CEDA publishes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('idea-files', 'idea-files', false, 10485760,
   array['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('documents', 'documents', true, 10485760, null)
on conflict (id) do nothing;

-- Paths look like <idea_id>/<random>-<file name>
create policy "idea files: read if you can see the idea" on storage.objects for select to authenticated
  using (bucket_id = 'idea-files' and public.can_see_idea(((storage.foldername(name))[1])::uuid));

create policy "idea files: owner uploads while editable" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'idea-files'
    and exists (select 1 from public.ideas i
                where i.id = ((storage.foldername(name))[1])::uuid
                  and i.owner_id = auth.uid() and i.stage in ('submitted', 'feedback'))
  );

create policy "idea files: owner deletes while editable" on storage.objects for delete to authenticated
  using (
    bucket_id = 'idea-files'
    and exists (select 1 from public.ideas i
                where i.id = ((storage.foldername(name))[1])::uuid
                  and i.owner_id = auth.uid() and i.stage in ('submitted', 'feedback'))
  );

create policy "documents: admins manage" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.has_role('admin'))
  with check (bucket_id = 'documents' and public.has_role('admin'));
