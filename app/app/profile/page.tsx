import { requireMe, supabaseServer } from '@/lib/supabase/server';
import ActionForm from '@/components/action-form';
import { updateProfile } from '@/app/app/actions';
import DeleteAccount from './delete-account';

export const metadata = { title: 'Profile and alerts' };

export default async function Profile() {
  const me = await requireMe();
  const sb = await supabaseServer();
  const { data: districts } = await sb.from('districts').select('name').order('name');
  return (
    <div className="stack" style={{ maxWidth: 620 }}>
      <h1>Profile and alerts</h1>
      <p><a href="/reset-password">Change my password</a></p>
      <div className="card">
        <ActionForm action={updateProfile} submit="Save">
          <div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" defaultValue={me.full_name} required maxLength={120} /></div>
          <div className="field"><label>Email</label><p style={{ margin: 0 }}>{me.email}</p></div>
          <div className="field"><label htmlFor="organisation">Company or organisation</label><input id="organisation" name="organisation" defaultValue={me.organisation ?? ''} maxLength={120} /></div>
          <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" defaultValue={me.phone ?? ''} maxLength={20} /></div>
          <div className="field">
            <label htmlFor="district">District or town</label>
            <select id="district" name="district" defaultValue={me.district ?? ''}>
              <option value="">Not set</option>
              {districts?.map((d) => <option key={d.name}>{d.name}</option>)}
            </select>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: '1.25rem 0 0' }}>
            <legend style={{ fontWeight: 600 }}>Alerts about your ideas</legend>
            <span className="hint">Free. Sent whenever an idea changes stage or gets feedback.</span>
            <label className="row" style={{ fontWeight: 400 }}><input type="checkbox" name="alerts_in_app" defaultChecked={me.alerts_in_app} /> On my dashboard</label>
            <label className="row" style={{ fontWeight: 400 }}><input type="checkbox" name="alerts_email" defaultChecked={me.alerts_email} /> By email</label>
          </fieldset>
        </ActionForm>
      </div>
      {me.role === 'submitter' && <DeleteAccount userId={me.id} />}
    </div>
  );
}
