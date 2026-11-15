import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const db = new PGlite();
const M = new URL('../migrations/', import.meta.url).pathname;
await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}', last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
create table storage.buckets (id text primary key, name text, public bool, file_size_limit int, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
grant usage on schema public, auth, storage to anon, authenticated;
`);
for (const f of ['0001_init.sql','0002_storage.sql','0003_seed.sql','0004_hardening.sql','0005_lock_internal_functions.sql']) {
  try { await db.exec(fs.readFileSync(M+f,'utf8').replace('create extension if not exists pgcrypto;','')); console.log('ok', f); }
  catch (e) { console.log('FAIL', f, e.message); process.exit(1); }
}
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon; grant usage, select on all sequences in schema public to authenticated;`);
const U = { sub:'00000000-0000-0000-0000-000000000001', ev:'00000000-0000-0000-0000-000000000002', adj:'00000000-0000-0000-0000-000000000003', other:'00000000-0000-0000-0000-000000000004', agent:'00000000-0000-0000-0000-000000000005' };
for (const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)`, [id, k+'@x.bw', {full_name:k, role:'admin'}]);
await db.exec(`update public.profiles set role='evaluator' where id='${U.ev}'; update public.profiles set role='adjudicator' where id='${U.adj}'; update public.profiles set role='agent' where id='${U.agent}';`);
const as = async (who, sql, params=[]) => {
  await db.exec(`reset role; select set_config('request.uid','${U[who]}',false); set role authenticated;`);
  try { const r = await db.query(sql, params); return r.rows; } catch(e) { return 'ERR: '+e.message; } finally { await db.exec('reset role'); }
};
const check = (name, got, pass) => console.log(pass(got) ? 'PASS' : 'FAIL', name, pass(got) ? '' : JSON.stringify(got));
check('role from metadata ignored', (await db.query(`select role from public.profiles where id=$1`,[U.sub])).rows[0].role, r=>r==='submitter');
const answers = {problem:'p'.repeat(30), solution:'s', beneficiaries:'b', impact:'i', readiness:'Researched'};
check('missing answer rejected', await as('sub', `select * from public.submit_idea('Solar dryer','A solar crop dryer for small farmers',1::smallint,'Gaborone',$1)`, [{problem:'x'}]), r=>typeof r==='string' && r.includes('Please answer'));
const idea = (await as('sub', `select * from public.submit_idea('Solar dryer','A solar crop dryer for small farmers',1::smallint,'Gaborone',$1)`, [answers]))[0];
check('submit works', idea?.ref, r=>/^CEDA-\d\d-0001$/.test(r));
check('direct update blocked', await as('sub', `update public.ideas set stage='awarded' returning id`), r=>Array.isArray(r) && r.length===0);
check('other user cannot see', await as('other', `select id from public.ideas`), r=>r.length===0);
check('evaluator unassigned cannot see', await as('ev', `select id from public.ideas`), r=>r.length===0);
check('self role escalation blocked', await as('sub', `update public.profiles set role='admin' where id=auth.uid()`), r=>typeof r==='string');
check('submitter cannot move', await as('sub', `select public.move_idea($1,'approved','x')`,[idea.id]), r=>typeof r==='string');
check('review needs evaluator', await as('adj', `select public.move_idea($1,'in_review',null)`,[idea.id]), r=>typeof r==='string' && r.includes('Assign'));
check('assign', await as('adj', `select public.assign_evaluator($1,$2)`,[idea.id,U.ev]), r=>Array.isArray(r));
check('start review', await as('adj', `select public.move_idea($1,'in_review',null)`,[idea.id]), r=>Array.isArray(r));
check('evaluator sees now', await as('ev', `select id from public.ideas`), r=>r.length===1);
const crit = (await db.query(`select id from public.criteria order by sort`)).rows;
const sc = Object.fromEntries(crit.map((c,i)=>[c.id,{score:6+i%3,comment:'ok'}]));
check('out of range score rejected', await as('ev', `select public.save_scores($1,$2,true)`,[idea.id,{[crit[0].id]:{score:11}}]), r=>typeof r==='string');
check('final scores', await as('ev', `select public.save_scores($1,$2,true)`,[idea.id,sc]), r=>Array.isArray(r));
check('locked after final', await as('ev', `select public.save_scores($1,$2,false)`,[idea.id,sc]), r=>typeof r==='string');
check('submitter cannot see scores', await as('sub', `select * from public.scores`), r=>r.length===0);
check('adjudicator score pct', await as('adj', `select public.idea_score_pct($1) p`,[idea.id]), r=>Number(r[0].p)>0);
check('feedback needs note', await as('adj', `select public.move_idea($1,'feedback','')`,[idea.id]), r=>typeof r==='string');
check('return with feedback', await as('adj', `select public.move_idea($1,'feedback','Add costing please')`,[idea.id]), r=>Array.isArray(r));
check('internal note hidden', (await as('ev', `insert into public.feedback(idea_id,author_id,body,internal) values ($1,auth.uid(),'secret',true) returning id`,[idea.id])) && await as('sub', `select body from public.feedback`), r=>r.length===1 && r[0].body==='Add costing please');
check('resubmit', await as('sub', `select version, stage from public.resubmit_idea($1,'Solar dryer v2','A solar crop dryer for small farmers, costed',1::smallint,'Kweneng',$2,'Added costs')`,[idea.id,answers]), r=>r[0]?.version===2 && r[0]?.stage==='in_review');
check('scores unlocked after resubmit', await as('ev', `select public.save_scores($1,$2,true)`,[idea.id,sc]), r=>Array.isArray(r));
check('approve', await as('adj', `select public.move_idea($1,'approved','Strong')`,[idea.id]), r=>Array.isArray(r));
check('award', await as('adj', `select public.move_idea($1,'awarded','Winner')`,[idea.id]), r=>Array.isArray(r));
check('notifications', await as('sub', `select title from public.notifications order by id`), r=>r.length>=5);
check('other cannot read notifications', await as('other', `select * from public.notifications`), r=>r.length===0);
check('audit submitter blocked', await as('sub', `select * from public.audit_log`), r=>r.length===0);
await db.exec(`select set_config('request.uid','',false); update public.profiles set role='admin' where id='${U.other}'`);
check('audit admin reads', await as('other', `select count(*)::int n from public.audit_log`), r=>r[0].n>5);
await as('other', `delete from public.audit_log`); await as('other', `update public.audit_log set action='x'`);
check('audit immutable', (await db.query(`select count(*)::int n, count(*) filter (where action='x')::int x from public.audit_log`)).rows[0], r=>r.n>5 && r.x===0);
check('report', await as('adj', `select public.report_overview() r`), r=>r[0].r.totals.ideas===1);
check('report blocked for submitter', await as('sub', `select public.report_overview()`), r=>typeof r==='string');
const t = await as('sub', `select * from public.open_chat('Help','Hello there',null)`);
check('chat open', t, r=>Array.isArray(r) && r[0].id);
check('agent sees chat', await as('agent', `select id from public.chat_threads`), r=>r.length===1);
check('other user cannot post in chat', await as('ev', `insert into public.chat_messages(thread_id,sender_id,body) values ($1,auth.uid(),'hi')`,[t[0].id]), r=>typeof r==='string');
check('agent claims', await as('agent', `select public.claim_chat($1)`,[t[0].id]), r=>Array.isArray(r));
check('agent replies', await as('agent', `insert into public.chat_messages(thread_id,sender_id,body) values ($1,auth.uid(),'hi') returning id`,[t[0].id]), r=>Array.isArray(r));
check('first reply tracked', (await db.query(`select first_reply_at from public.chat_threads`)).rows[0].first_reply_at, r=>!!r);
check('chat hours fn', (await db.query(`select public.chat_is_open('2026-11-16 10:00+02') a, public.chat_is_open('2026-11-16 17:00+02') b, public.chat_is_open('2026-12-25 10:00+02') c`)).rows[0], r=>r.a && !r.b && !r.c);
check('anon cannot submit', await (async()=>{await db.exec(`select set_config('request.uid','',false); set role anon;`); try{await db.query(`select public.submit_idea('aaaaa','bbbbbbbbbbbbbbbbbbbbbbbb',1::smallint,'Gaborone','{}')`);return 'ran'}catch(e){return 'ERR'}finally{await db.exec('reset role')}})(), r=>r==='ERR');

const own = (await as('ev', `select * from public.submit_idea('Evaluator idea','An idea submitted by an evaluator account',1::smallint,'Gaborone',$1)`, [answers]))[0];
check('no self evaluation', await as('adj', `select public.assign_evaluator($1,$2)`,[own.id,U.ev]), r=>typeof r==='string' && r.includes('own idea'));
const adjIdea = (await as('adj', `select * from public.submit_idea('Adjudicator idea','An idea submitted by an adjudicator account',1::smallint,'Gaborone',$1)`, [answers]))[0];
check('no self decision', await as('adj', `select public.move_idea($1,'rejected','no')`,[adjIdea.id]), r=>typeof r==='string' && r.includes('own idea'));
let last; for (let i=0;i<6;i++) last = await as('sub', `select id from public.submit_idea('Bulk idea ${i}','Testing the hourly submission limit here',1::smallint,'Gaborone',$1)`, [answers]);
check('submission rate limit', last, r=>typeof r==='string' && r.includes('5 ideas'));
