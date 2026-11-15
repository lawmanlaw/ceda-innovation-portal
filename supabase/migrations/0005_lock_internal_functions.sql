-- Internal helpers and trigger functions are not callable through the API
revoke execute on function
  public.notify(uuid, uuid, text, text), public.validate_answers(jsonb),
  public.handle_new_user(), public.guard_profile_update(), public.write_audit(), public.block_audit_changes(),
  public.audit_sign_in(), public.on_stage_history(), public.on_feedback(), public.on_chat_message()
from public, anon, authenticated;
