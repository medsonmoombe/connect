const fs = require('fs');
const { Client } = require('pg');
const env = fs.readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  // Latest audit log entries for Chambeshi
  const r = await c.query(`
    SELECT action_type, before_state->>'status' AS before_status, after_state->>'status' AS after_status, created_at
    FROM audit_logs
    WHERE entity_id = 'a3ce64d2-84ca-43b6-b1a9-578686840196'
      AND entity_type = 'projects'
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log('Audit log for Chambeshi:');
  for (const row of r.rows) {
    console.log(`  ${row.created_at.toISOString()}  ${row.action_type}  ${row.before_status || '—'} → ${row.after_status || '—'}`);
  }
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
