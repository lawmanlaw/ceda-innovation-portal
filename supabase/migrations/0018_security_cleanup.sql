-- Security pass: remove leftovers attackers could call directly.
-- submit_idea skipped the drafts flow and the IP declaration; submitting now only goes through submit_draft.
drop function if exists public.submit_idea(text, text, smallint, text, jsonb);
drop function if exists public.set_server_key_hash(text);
drop function if exists public.server_key_linked();
drop function if exists public.server_ok(text);
drop table if exists public.server_keys;
-- Internal helpers are not part of the public API
revoke execute on function public.bump_photo() from anon;
revoke execute on function public.rate_ok(text, int, interval) from public, anon, authenticated;

