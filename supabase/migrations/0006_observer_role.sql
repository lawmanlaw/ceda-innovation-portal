-- Read-only role for committee members who monitor progress but do not score or decide
alter type public.app_role add value if not exists 'observer';
