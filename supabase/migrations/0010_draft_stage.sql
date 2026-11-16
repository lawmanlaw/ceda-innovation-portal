-- Ideas can be saved as drafts before they are submitted
alter type public.idea_stage add value if not exists 'draft' before 'submitted';
