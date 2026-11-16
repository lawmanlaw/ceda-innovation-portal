import { requireMe, supabaseServer } from '@/lib/supabase/server';
import SwipeDeck, { type Card } from './swipe-deck';

export const metadata = { title: 'Community challenges' };

export default async function InnovatorChallenges() {
  const me = await requireMe('submitter');
  const sb = await supabaseServer();
  const [{ data: list }, { data: mine }, { data: districts }] = await Promise.all([
    sb.from('challenges').select('id, title, description, sector, district, lat, lng, upvotes, has_photo').eq('status', 'approved').order('upvotes', { ascending: false }).limit(500),
    sb.from('interests').select('challenge_id, saved').eq('user_id', me.id),
    sb.from('districts').select('name').order('name'),
  ]);
  return (
    <div className="stack">
      <h1>Community challenges</h1>
      <p className="muted">Real problems reported by people across Botswana. Swipe right to save one to your basket of interests, left to skip. Problems near you come first.</p>
      <SwipeDeck userId={me.id} home={me.district ?? null} cards={(list ?? []) as Card[]} decided={mine ?? []} districts={(districts ?? []).map((d) => d.name)} />
    </div>
  );
}
