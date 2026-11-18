-- More demo ideas for the CEDA portal: 6 in review, 3 approved, 3 awarded (with next steps and an update)
do $$
declare
  inv uuid := '47704983-4825-42c5-9da1-ea785b89b8cb';
  e1 uuid := 'd4e5a7fe-58ba-4a9e-85ae-be3cd2fa5be2';
  e2 uuid := 'cb915e72-d57a-4271-ab1a-11d6a32b58ca';
  adj uuid := 'b6fb1f44-5906-4daf-a51b-7adb7d39c6d5';
  r record; nid uuid; c uuid; k int := 0;
begin
  for r in select * from (values
    ('Solar cold rooms for Tuli Block farmers','Shared solar powered cold rooms so small horticulture farmers keep produce fresh and sell later at better prices.',1,'Central','in_review'),
    ('Mobile app for spaza shop stock credit','A simple app that lets small shops order stock on credit from wholesalers using their sales history as a score.',8,'Gaborone','in_review'),
    ('Mophane worm processing and packaging','A hygienic drying and packaging line that turns seasonal mophane harvests into a year round branded snack.',1,'Central','in_review'),
    ('Recycled glass paving bricks','Crushing waste glass bottles into paving bricks for municipal walkways, cutting landfill and cement use.',2,'Gaborone','in_review'),
    ('Chobe river guided kayak tours','Locally owned eco kayak tours on the Chobe river run by trained youth guides from Kasane.',4,'Chobe','in_review'),
    ('Telehealth booths at rural clinics','Booths with a tablet and basic devices so rural patients see a doctor in Gaborone by video.',7,'Kweneng','in_review'),
    ('Biogas units from cattle post manure','Small biogas digesters that turn manure into cooking gas and fertiliser for cattle post households.',5,'Ghanzi','approved'),
    ('Leather goods from local hides','Tanning and stitching Botswana hides into bags and belts instead of exporting raw hides.',2,'Southern','approved'),
    ('CEDA loan status SMS alerts','Automatic SMS updates to applicants at each stage of a CEDA loan application.',9,'Gaborone','approved'),
    ('Copper offcut jewellery studio','Turning copper offcuts from mines into handmade jewellery sold to tourists and online.',6,'Central','awarded'),
    ('Hydroponic fodder for dry seasons','Container hydroponic units that grow green fodder for livestock in ten days with little water.',1,'Kweneng','awarded'),
    ('Setswana coding club platform','An online platform that teaches school leavers to code with lessons in Setswana and English.',3,'Gaborone','awarded')
  ) v(t,s,cat,d,st) loop
    k := k + 1;
    insert into public.ideas (owner_id,title,summary,category_id,district,stage,answers,submitted_at,stage_changed_at)
    values (inv, r.t, r.s, r.cat::smallint, r.d, r.st::public.idea_stage,
      jsonb_build_object('problem','Local businesses and households face this gap today and pay more as a result.',
        'solution', r.s, 'beneficiaries','Small businesses, youth and rural households in '||r.d||'.',
        'impact','New jobs, lower costs and income that stays in the district.',
        'readiness','A working prototype has been tested with ten local users.',
        'resources','Seed funding, mentorship and access to CEDA business support.'),
      now() - (k*3||' days')::interval, now() - (k||' days')::interval)
    returning id into nid;
    insert into public.assignments (idea_id, evaluator_id, submitted_at)
      values (nid, e1, case when r.st <> 'in_review' or k % 2 = 0 then now() end),
             (nid, e2, case when r.st <> 'in_review' then now() end);
    if r.st <> 'in_review' or k % 2 = 0 then
      for c in select id from public.criteria where active loop
        insert into public.scores (idea_id, evaluator_id, criterion_id, score) values (nid, e1, c, 3 + (k % 3));
        if r.st <> 'in_review' then insert into public.scores (idea_id, evaluator_id, criterion_id, score) values (nid, e2, c, 3 + ((k+1) % 3)); end if;
      end loop;
    end if;
    if r.st = 'awarded' then
      insert into public.milestones (idea_id,title,due_date,done_at,sort,created_by) values
        (nid,'Register the business with CIPA', current_date - 10, now() - interval '9 days', 0, adj),
        (nid,'Open a business bank account', current_date + 7, null, 1, adj),
        (nid,'Submit a one year budget to CEDA', current_date + 21, null, 2, adj),
        (nid,'First progress review with the panel', current_date + 45, null, 3, adj);
      insert into public.project_updates (idea_id,author_id,body) values
        (nid, adj, 'Congratulations on the award. Please start with company registration and share the certificate here.'),
        (nid, inv, 'Registration done, certificate received. Bank account appointment is next week.');
    end if;
  end loop;
end $$;
