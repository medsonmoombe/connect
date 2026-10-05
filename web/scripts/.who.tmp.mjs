import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: logs } = await sb.from('audit_logs')
  .select('action_type, created_at, user_id, entity_id, after_state')
  .eq('entity_id', 'b735434f-3d51-4698-98de-49184aa3efdf')
  .order('created_at', { ascending: false })
  .limit(14);
for (const l of logs ?? []) console.log(l.created_at.slice(11, 19), l.action_type, 'user:', l.user_id, JSON.stringify(l.after_state)?.slice(0, 90));
