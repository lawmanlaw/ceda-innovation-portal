# CEDA Innovation Portal

A web portal where innovators submit ideas, CEDA's panel evaluates and decides on them, and communities report problems for innovators to solve.

Live: https://ceda-innovation-portal.vercel.app

The home page opens with a 3D CEDA headset that turns as you scroll through what the portal does. Every screen works on phones as well as computers.

## How it works

**Innovators**
1. Sign up with email or Google. Bokamoso, the portal guide, gives a short tour.
2. Start an idea. It saves as a draft while you type. Drop a pin for where it will happen and attach files (each one is checked for viruses and hidden code).
3. Go through the checklist and submit. Once submitted, the idea is final unless the panel asks for changes.
4. Follow the idea through each stage: Submitted, In review, Needs changes, Approved, Awarded. Alerts arrive at every step.
5. Once awarded, work through the next steps CEDA sets and share progress in a private project space with your panel.
6. Swipe through community challenges and save the ones you would like to solve. You can delete any of your ideas at any time.

**Evaluators** score assigned ideas on CEDA's six categories (1 Poor to 5 Excellent) with comments. Each one sees location facts and similar ideas nearby, and can step out of a review if they have a conflict of interest.

**Adjudicators** assign evaluators and read the combined scores. They approve, decline with a reason, or send an idea back with feedback, and can email the innovator in one tick. When awarding, they set next steps with due dates and track them. Any idea can be downloaded as a Word document with a blank evaluation sheet for offline comments.

**Administrators** manage users, criteria, form questions, FAQs and content, moderate community reports, see reports and the audit trail, and can also decide on and award ideas.

**Communities** (no account needed) report a problem with a pin and an optional photo, get a tracking code, and upvote problems that affect them. A moderator approves each report before it appears on the challenge map.

**Live chat** connects anyone to a CEDA consultant, after first suggesting help articles.

## Built with

Next.js, Supabase (Postgres with row-level security, authentication, storage and realtime), Vercel hosting, OpenStreetMap, and three.js for the 3D headset.

## Run it yourself

1. Create a Supabase project and run the files in `supabase/migrations` in order.
2. Copy `.env.example` to `.env.local` and fill in your Supabase URL and publishable key.
3. Run `npm install`, then `npm run dev`, and open http://localhost:3000.

Security tests: `npm run test:db` and `npm run test:files`.

Built by Neoterra (Pty) Ltd for the CEDA x BDIH Innovation Portal Hackathon, 2026.
