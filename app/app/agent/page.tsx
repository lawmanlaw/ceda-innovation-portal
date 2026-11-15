import { requireMe } from '@/lib/supabase/server';
import AgentConsole from './agent-console';

export const metadata = { title: 'Live chat' };

export default async function AgentPage() {
  const me = await requireMe('agent', 'admin');
  return (
    <div className="stack">
      <h1>Live chat</h1>
      <p className="muted">Keep this page open while you are on duty. Several consultants can work at once, and each of you can handle several chats.</p>
      <AgentConsole me={me.id} />
    </div>
  );
}
