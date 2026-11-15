-- Starting content. Admins can change all of it from the portal.

insert into public.districts (name) values
  ('Gaborone'), ('Francistown'), ('Lobatse'), ('Selebi-Phikwe'), ('Jwaneng'), ('Orapa'), ('Sowa Town'),
  ('Central'), ('Ghanzi'), ('Kgalagadi'), ('Kgatleng'), ('Kweneng'), ('North-East'), ('North-West'),
  ('South-East'), ('Southern'), ('Chobe')
on conflict do nothing;

insert into public.categories (name) values
  ('Agriculture and agro-processing'), ('Manufacturing'), ('Digital and technology'), ('Tourism and creative'),
  ('Energy and environment'), ('Mining value chain'), ('Health'), ('Financial services'),
  ('Internal CEDA process improvement'), ('Other')
on conflict do nothing;

insert into public.form_fields (key, label, help, kind, required, max_length, sort) values
  ('problem', 'What problem does this solve?', 'Who has the problem and how do you know?', 'textarea', true, 2000, 10),
  ('solution', 'Your solution', 'How it works, in plain language.', 'textarea', true, 3000, 20),
  ('beneficiaries', 'Who benefits?', 'Customers, communities, CEDA, or others.', 'textarea', true, 1500, 30),
  ('impact', 'Expected impact', 'Jobs, income, savings, or other results you expect.', 'textarea', true, 1500, 40),
  ('readiness', 'How far along is it?', null, 'select', true, 60, 50),
  ('resources', 'What do you need from CEDA?', 'Funding, mentorship, partners, or something else.', 'textarea', false, 1500, 60)
on conflict (key) do nothing;

update public.form_fields
set options = '["Just an idea", "Researched", "Prototype built", "Tested with users", "Already earning revenue"]'::jsonb
where key = 'readiness';

insert into public.criteria (name, description, weight, max_score, sort) values
  ('Originality', 'How new the idea is for Botswana or for CEDA.', 2, 10, 10),
  ('Feasibility', 'Can it realistically be built and run?', 2, 10, 20),
  ('Economic impact', 'Jobs, income, exports or savings it could create.', 3, 10, 30),
  ('Alignment with CEDA priorities', 'Fit with CEDA strategy and national development goals.', 2, 10, 40),
  ('Scalability', 'Can it grow beyond one place or customer?', 1, 10, 50);

insert into public.faqs (question, answer, topic, sort) values
  ('Who can submit an idea?', 'Any registered user. Create an account with your email address, confirm it with the code we send you, and you can submit.', 'Submitting', 10),
  ('Can I change my idea after submitting?', 'You can add or remove attachments until review starts. If evaluators return your idea with feedback, you can edit it and resubmit.', 'Submitting', 20),
  ('How are ideas evaluated?', 'Each idea is scored by at least one evaluator against published criteria. An adjudication panel then approves it, returns it for changes, or declines it.', 'Evaluation', 30),
  ('How will I know what is happening?', 'Your dashboard shows the current stage of every idea. You also get an alert each time the stage changes or someone leaves feedback.', 'Tracking', 40),
  ('Who owns my idea?', 'You remain the owner of your submission. CEDA uses it only to evaluate and support it, in line with the Data Protection Act, 2024.', 'Privacy', 50),
  ('When can I chat with a consultant?', 'Live chat is staffed 09:00 to 16:00, Monday to Friday, excluding public holidays. Messages sent outside those hours are answered the next working day.', 'Help', 60);

insert into public.authorities (name, remit, website, sort) values
  ('Companies and Intellectual Property Authority (CIPA)', 'Company registration, patents, trademarks', 'https://www.cipa.co.bw', 10),
  ('Botswana Unified Revenue Service (BURS)', 'Tax registration and clearance', 'https://www.burs.org.bw', 20),
  ('Botswana Bureau of Standards (BOBS)', 'Product standards and certification', 'https://www.bobstandards.bw', 30),
  ('Botswana Communications Regulatory Authority (BOCRA)', 'Telecoms, internet and postal licensing', 'https://www.bocra.org.bw', 40),
  ('Local Enterprise Authority (LEA)', 'SME development and mentoring', 'https://www.lea.co.bw', 50);

insert into public.pages (slug, title, body) values
  ('about', 'About the Innovation Portal', 'The CEDA Innovation Portal takes ideas from submission through evaluation to recognition and reward.'),
  ('privacy', 'Privacy notice', 'We collect only what we need to evaluate your idea and contact you about it. Your data is processed in line with the Botswana Data Protection Act, 2024, is visible only to the people evaluating it, and is kept only as long as necessary.'),
  ('support', 'Support and fault handling', 'Report a fault through live chat or by email. Critical faults (portal unavailable): response within 1 hour, fix within 4 hours. Major faults (a feature not working): response within 4 hours, fix within 1 working day. Minor issues: fix within 5 working days.');

insert into public.public_holidays (day, name) values
  ('2026-01-01', 'New Year''s Day'), ('2026-01-02', 'New Year Holiday'),
  ('2026-04-03', 'Good Friday'), ('2026-04-04', 'Holy Saturday'), ('2026-04-06', 'Easter Monday'),
  ('2026-05-01', 'Labour Day'), ('2026-05-14', 'Ascension Day'),
  ('2026-07-01', 'Sir Seretse Khama Day'), ('2026-07-20', 'President''s Day'), ('2026-07-21', 'President''s Day Holiday'),
  ('2026-09-30', 'Botswana Day'), ('2026-10-01', 'Botswana Day Holiday'),
  ('2026-12-25', 'Christmas Day'), ('2026-12-26', 'Boxing Day')
on conflict do nothing;
