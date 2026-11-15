import { requireMe, supabaseServer } from '@/lib/supabase/server';
import UserChat from './user-chat';

export const metadata = { title: 'Chat with CEDA' };
export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const me = await requireMe();
  const sb = await supabaseServer();
  const [{ data: open }, { data: online }, { data: threads }, { data: ideas }] = await Promise.all([
    sb.rpc('chat_is_open'),
    sb.rpc('agents_online'),
    sb.from('chat_threads').select('id, topic, status, created_at').eq('user_id', me.id).order('created_at', { ascending: false }).limit(10),
    sb.from('ideas').select('id, ref, title').eq('owner_id', me.id),
  ]);
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Chat with CEDA</h1>
      <p className={open ? 'notice' : 'notice bad'}>
        {open
          ? (online as number) > 0
            ? 'Consultants are online now. Ask about your submission or anything else.'
            : 'We are open, but no consultant is available at the moment. Leave a message and we will reply as soon as someone is free.'
          : 'Live chat is staffed 09:00 to 16:00, Monday to Friday. You can still leave a message and we will reply on the next working day.'}
      </p>
      <UserChat me={me.id} threads={threads ?? []} ideas={ideas ?? []} />
    </div>
  );
}
