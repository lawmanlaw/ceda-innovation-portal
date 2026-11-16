# CEDA Innovation Portal

A web portal where people submit ideas to CEDA, evaluation teams score them against criteria CEDA controls, and every idea moves through submission, review, feedback, approval and award. Built by Neoterra for the CEDA x BDIH Innovation Portal Hackathon, November 2026.

## What it does

| Role | Can do |
|---|---|
| Innovator | Register with email verification, submit ideas through a form with required fields, attach files, track each idea's stage live, reply to feedback, edit and resubmit, withdraw, chat with a consultant, choose free alerts |
| Evaluator | See only the ideas assigned to them, score each criterion with reasons, save drafts, submit final scores, leave feedback or internal notes |
| Adjudicator | See every idea, assign evaluators, see weighted results, approve, return with feedback, decline, award, view reports |
| Administrator | Everything above, plus roles, evaluation criteria, application form questions, templates, FAQs, regulatory contacts, pages, chat holidays and the audit trail |
| Service consultant | Live chat console with several chats at once, shared queue, after-hours handling |

## Stack

- Next.js 15 (App Router, server actions), TypeScript
- Supabase: Postgres with row level security, Auth (password, email one-time code, password recovery), Storage, Realtime
- Hosted on Vercel; database on Supabase (AWS eu-west-2, London)

## Security design

- **Permissions live in the database.** Every table has row level security. A user who changes an ID in the browser gets nothing back.
- **The workflow can't be skipped.** Ideas have no update policy at all. Stage changes go through `move_idea`, `resubmit_idea` and `save_scores`, which check the role and the allowed transitions.
- **Roles can't be self-assigned.** Sign-up metadata never sets a role, and a trigger blocks anyone but an admin from changing one.
- **Audit trail** written by triggers on every sensitive table plus every sign-in. Admins can read it; nobody can edit or delete it.
- **Rate limits and conflict of interest rules in the database.** Submissions, chat and feedback are capped per user, and nobody can evaluate or decide their own idea.
- **Private files** in a private bucket, served through 5 minute signed links, only to people who can see the idea.
- **No secrets in the browser.** The app uses only the publishable key; there is no service key in this codebase.
- Security headers (CSP, frame blocking, HSTS), no `X-Powered-By`, no browser source maps, safe redirects, CSV export protected against formula injection, sign-in messages that don't reveal who is registered.

Run the database security tests (52 checks, no Supabase account needed):

```
npm run test:db
```

## Run it

1. Create a Supabase project and run the files in `supabase/migrations` in order (SQL editor or `supabase db push`).
2. In Supabase Auth, email templates: put `{{ .Token }}` in the Confirm signup, Magic link and Reset password templates so users get a 6 digit code. Set minimum password length to 10 and the email code expiry to 600 seconds. Turn on CAPTCHA and leaked password protection under Auth settings.
3. Make your first admin in the SQL editor:
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
4. Copy `.env.example` to `.env.local` and fill in the URL and publishable key.
5. `npm install` then `npm run dev`.

## Health check

`GET /api/health` returns `{ ok, db_ms }` for uptime monitoring.
