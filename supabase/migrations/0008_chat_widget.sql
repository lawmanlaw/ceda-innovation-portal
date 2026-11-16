-- Live chat widget: queue position and the consultant's first name for the person waiting
create or replace function public.chat_status(p_thread uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare t public.chat_threads;
begin
  select * into t from public.chat_threads where id = p_thread and user_id = auth.uid();
  if t.id is null then return null; end if;
  return jsonb_build_object(
    'position', case when t.status = 'waiting' then
      (select count(*) from public.chat_threads w where w.status = 'waiting' and w.agent_id is null and w.created_at <= t.created_at) end,
    'agent', (select split_part(full_name, ' ', 1) from public.profiles where id = t.agent_id)
  );
end $$;
revoke execute on function public.chat_status(uuid) from public, anon;
grant execute on function public.chat_status(uuid) to authenticated;
-- Visitors see whether consultants are online before signing in (a count only)
grant execute on function public.agents_online() to anon;

insert into public.faqs (question, answer, topic, sort) values
  ('How long does evaluation take?', 'Most ideas get a first decision within 3 to 4 weeks of review starting. Your dashboard shows the current stage, and you get an alert at every step.', 'Evaluation', 35),
  ('What files can I attach?', 'PDF, Word, Excel, PowerPoint, PNG and JPG files, up to 10 MB each and 10 files per idea. You can add or remove files until review starts.', 'Submitting', 25),
  ('Can I submit more than one idea?', 'Yes. Each idea is evaluated separately and gets its own reference number.', 'Submitting', 26),
  ('I did not get my confirmation email', 'Check your spam or junk folder first. The link expires after 1 hour, so if it has expired, sign up again with the same email or use Forgot password on the sign-in page.', 'Account', 70),
  ('How do I change or reset my password?', 'Signed in: open Profile and choose Change my password. Signed out: choose Forgot password on the sign-in page and follow the link we email you.', 'Account', 71),
  ('My idea was returned with feedback. What now?', 'Open the idea from your dashboard, read the panel''s note, then choose Edit and resubmit. Your new version goes straight back to the evaluators.', 'Evaluation', 36);
