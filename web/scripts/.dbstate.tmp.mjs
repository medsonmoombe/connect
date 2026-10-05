import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function env() {
  const txt = readFileSync('.env.local', 'utf8');
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const e = env();
const supabase = createClient(e['NEXT_PUBLIC_SUPABASE_URL'], e['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } });

const { data } = await supabase.from('project_scores').select('*').limit(1);
const s = data[0];
const top = { ...s };
delete top.breakdown;
console.log('=== project_scores columns ===');
console.log(JSON.stringify(top, null, 2));

const b = s.breakdown || {};
console.log('\n=== breakdown top-level keys ===');
console.log(Object.keys(b).join(', '));

console.log('\n=== breakdown.rating_insight ===');
console.log(JSON.stringify(b.rating_insight, null, 2).slice(0, 5000));

console.log('\n=== breakdown.recommendations ===');
console.log(JSON.stringify(b.recommendations ?? s.recommendations ?? null, null, 2).slice(0, 2000));

console.log('\n=== breakdown.risk_flags / strengths / weaknesses ===');
console.log(JSON.stringify({ risk_flags: b.risk_flags, strengths: b.strengths, weaknesses: b.weaknesses }, null, 2).slice(0, 3000));