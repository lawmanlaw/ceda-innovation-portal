-- Observers can follow every idea through its stages; they cannot score, decide or post
create or replace function public.can_see_idea(p_idea uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.ideas where id = p_idea and owner_id = auth.uid())
      or public.has_role('admin', 'adjudicator', 'observer')
      or exists (select 1 from public.assignments where idea_id = p_idea and evaluator_id = auth.uid())
$$;

drop policy "post feedback" on public.feedback;
create policy "post feedback" on public.feedback for insert to authenticated
  with check (
    author_id = auth.uid() and public.can_see_idea(idea_id) and not public.has_role('observer')
    and (not internal or public.has_role('admin', 'adjudicator', 'evaluator'))
    and exists (select 1 from public.ideas where id = idea_id and stage not in ('withdrawn', 'rejected', 'awarded'))
  );

insert into public.pages (slug, title, body) values
  ('hosting', 'Hosting and availability', 'The website is hosted on Vercel, with its server code set to run in London. The database, sign-in service and uploaded files are hosted on Supabase, on Amazon Web Services in London (region eu-west-2), where all personal data is stored and encrypted at rest.

Storage costs: the prototype runs on the Supabase free plan, which includes 500 MB of database space and 1 GB of file storage. For production, the Pro plan costs 25 US dollars a month and includes 8 GB of database space and 100 GB of file storage. Beyond that, database space costs 0.125 US dollars per GB a month and file storage 0.021 US dollars per GB a month.

Availability: both services run 24 hours a day, 7 days a week. An automated check calls the portal every day, and uptime monitors can watch /api/health.')
on conflict (slug) do nothing;

update public.pages set body = 'We collect only what we need to evaluate your idea and contact you about it: your name, email address, organisation, district and what you submit. Your data is processed in line with the Botswana Data Protection Act, 2024. It is used only to evaluate and support your idea, is visible only to you and the CEDA panel assigned to it, and is stored in London, encrypted at rest. Submissions are kept only for as long as the innovation programme needs them.

You can see and correct your details under Profile at any time. To get a copy of your data, or to have your account and submissions deleted, ask through live chat or the support contact.'
where slug = 'privacy';
