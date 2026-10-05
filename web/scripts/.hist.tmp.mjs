import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const pid = process.argv[2];
const { data: p } = await sb.from('projects').select('id, name, status, project_stage, created_at, updated_at').eq('id', pid).single();
console.log('PROJECT:', JSON.stringify(p, null, 1));
const { data: h } = await sb.from('project_status_history').select('from_status, to_status, actor_id, reason, created_at').eq('project_id', pid).order('created_at');
console.log('HISTORY:', JSON.stringify(h, null, 1));
const { data: docs } = await sb.from('project_documents').select('id').eq('project_id', pid).is('deleted_at', null);
console.log('DOC COUNT:', (docs ?? []).length);
const { data: jobs } = await sb.from('ai_jobs').select('id, status, request_type, created_at, finished_at').eq('project_id', pid).order('created_at');
console.log('AI JOBS:', JSON.stringify(jobs, null, 1));
