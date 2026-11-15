-- Hardening: rate limits, conflict of interest rules, explicit audit log lock

-- Rate limits enforced in the database, so they hold even if someone calls the API directly.
-- auth.uid() is null only for trusted server contexts (seeding, SQL editor).
create or replace function public.rate_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'ideas' then
    select count(*) into n from public.ideas where owner_id = auth.uid() and submitted_at > now() - interval '1 hour';
    if n >= 5 then raise exception 'You can submit up to 5 ideas an hour. Please try again later.' using errcode = '22023'; end if;
  elsif tg_table_name = 'chat_threads' then
    select count(*) into n from public.chat_threads where user_id = auth.uid() and created_at > now() - interval '1 hour';
    if n >= 5 then raise exception 'Too many chats started. Please try again later.' using errcode = '22023'; end if;
  elsif tg_table_name = 'chat_messages' then
    if new.system then return new; end if;
    select count(*) into n from public.chat_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute';
    if n >= 20 then raise exception 'You are sending messages too fast. Please wait a moment.' using errcode = '22023'; end if;
  elsif tg_table_name = 'feedback' then
    select count(*) into n from public.feedback where author_id = auth.uid() and created_at > now() - interval '1 minute';
    if n >= 10 then raise exception 'You are posting too fast. Please wait a moment.' using errcode = '22023'; end if;
  elsif tg_table_name = 'attachments' then
    select count(*) into n from public.attachments where idea_id = new.idea_id;
    if n >= 10 then raise exception 'An idea can have up to 10 files.' using errcode = '22023'; end if;
  end if;
  return new;
end $$;

create trigger ideas_rate before insert on public.ideas for each row execute function public.rate_limit();
create trigger chat_threads_rate before insert on public.chat_threads for each row execute function public.rate_limit();
create trigger chat_messages_rate before insert on public.chat_messages for each row execute function public.rate_limit();
create trigger feedback_rate before insert on public.feedback for each row execute function public.rate_limit();
create trigger attachments_rate before insert on public.attachments for each row execute function public.rate_limit();

-- Conflict of interest: nobody evaluates or decides their own idea
create or replace function public.no_self_evaluation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.ideas where id = new.idea_id and owner_id = new.evaluator_id) then
    raise exception 'An evaluator cannot be assigned to their own idea' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger assignments_no_self before insert on public.assignments
for each row execute function public.no_self_evaluation();

create or replace function public.no_self_decision()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.owner_id and new.stage is distinct from old.stage
     and (new.stage in ('approved', 'awarded', 'rejected', 'feedback') or (old.stage = 'submitted' and new.stage = 'in_review')) then
    raise exception 'You cannot make decisions on your own idea' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger ideas_no_self_decision before update on public.ideas
for each row execute function public.no_self_decision();

-- Audit log: remove write privileges outright, on top of the trigger and row level security
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
revoke all on public.agent_presence from anon;
