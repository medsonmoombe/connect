import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, serverError, badRequest, forbidden, writeAuditLog, handleRouteError } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { sendAdminUserProvisionedEmail } from '@/lib/email';

type Params = { params: Promise<{ id: string }> };

async function requirePlatformAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user.is_platform_admin) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return user;
}

async function getOrg(admin: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const { data, error } = await admin
    .from('companies')
    .select('id, name, country, status, created_at, is_authority_org')
    .eq('id', id)
    .eq('is_authority_org', true)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

// ── GET /api/admin/authority-orgs/[id] — full detail: org + members + invites ──
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await params;
    const admin = getSupabaseAdmin();

    const org = await getOrg(admin, id);
    if (!org) return NextResponse.json({ error: 'Regulator organisation not found' }, { status: 404 });

    const [membersRes, invitesRes] = await Promise.all([
      admin
        .from('company_members')
        .select('role, user_id, created_at')
        .eq('company_id', id)
        .is('deleted_at', null)
        .order('role'),
      admin
        .from('setup_invites')
        .select('id, email, token, expires_at, created_at, membership_role')
        .eq('company_id', id)
        .is('deleted_at', null)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ]);

    const memberRows = membersRes.data ?? [];
    const userIds = memberRows.map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await admin.from('user_profiles').select('id, full_name, email, phone, job_title, mfa_enabled, suspended_at, created_at').in('id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => p.id !== undefined ? [p.id, p] : ['', p]));

    const members = memberRows.map((m) => ({ ...m, user_profiles: (profileMap as Map<string, any>).get(m.user_id) ?? null }));

    return NextResponse.json({ data: { ...org, members, invites: invitesRes.data ?? [] } });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e.status === 403) return forbidden();
    console.error('[authority-orgs/id] GET:', e);
    return serverError();
  }
}

// ── POST /api/admin/authority-orgs/[id] — provision a new user into this org ──
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const admin_user = await requirePlatformAdmin(req);
    const { id } = await params;
    const admin = getSupabaseAdmin();

    const org = await getOrg(admin, id);
    if (!org) return NextResponse.json({ error: 'Regulator organisation not found' }, { status: 404 });

    const { email, fullName, role = 'MEMBER' } = await req.json();
    if (!email?.trim()) return badRequest('email is required');
    if (!['ADMIN', 'MEMBER'].includes(role)) return badRequest('role must be ADMIN or MEMBER');

    const normalisedEmail = email.trim().toLowerCase();
    const { data: existingProfile } = await admin.from('user_profiles').select('id').ilike('email', normalisedEmail).maybeSingle();
    if (existingProfile) return badRequest('A user with this email already exists on the platform.');

    const generatedPassword = Math.random().toString(36).slice(-10) + 'A1!';
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: normalisedEmail,
      password: generatedPassword,
      email_confirm: true,
    });
    if (authErr || !authData.user) {
      return badRequest(authErr?.message?.includes('already') ? 'Email already registered' : 'Failed to create user account');
    }

    const userId = authData.user.id;
    await admin.from('user_profiles').insert({
      id: userId,
      email: normalisedEmail,
      full_name: fullName?.trim() || normalisedEmail,
      onboarding_complete: true,
    });
    await admin.from('company_members').insert({ user_id: userId, company_id: id, role });

    await writeAuditLog({
      userId: admin_user.id,
      action: 'AUTHORITY_USER_PROVISIONED',
      entityType: 'companies',
      entityId: id,
      after: { email: normalisedEmail, role },
    });

    sendAdminUserProvisionedEmail({
      to: normalisedEmail,
      email: normalisedEmail,
      generatedPassword,
    }).catch(() => {});

    return NextResponse.json({
      data: { user: { id: userId, email: normalisedEmail, generated_password: generatedPassword } },
      message: `User added to ${org.name}`,
    }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e.status === 403) return forbidden();
    return handleRouteError(e);
  }
}

// ── PATCH /api/admin/authority-orgs/[id] — activate / deactivate the org ──────
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin_user = await requirePlatformAdmin(req);
    const { id } = await params;
    const admin = getSupabaseAdmin();

    const org = await getOrg(admin, id);
    if (!org) return NextResponse.json({ error: 'Regulator organisation not found' }, { status: 404 });

    const { action } = await req.json();
    if (!['activate', 'deactivate'].includes(action)) return badRequest("action must be 'activate' or 'deactivate'");

    // Deactivating also suspends all active member accounts so they cannot log in.
    // Reactivating restores them.
    const suspendValue = action === 'deactivate' ? new Date().toISOString() : null;

    const { data: members } = await admin.from('company_members').select('user_id').eq('company_id', id).is('deleted_at', null);
    const memberIds = (members ?? []).map((m) => m.user_id);

    if (memberIds.length > 0) {
      await admin.from('user_profiles').update({ suspended_at: suspendValue }).in('id', memberIds);
    }

    const { error: updateErr } = await admin
      .from('companies')
      .update({ status: action === 'deactivate' ? 'deactivated' : 'verified' })
      .eq('id', id);

    if (updateErr) {
      console.error('[authority-orgs/id] PATCH:', updateErr.message);
      return serverError();
    }

    await writeAuditLog({
      userId: admin_user.id,
      action: action === 'deactivate' ? 'AUTHORITY_ORG_DEACTIVATED' : 'AUTHORITY_ORG_ACTIVATED',
      entityType: 'companies',
      entityId: id,
    });

    return NextResponse.json({
      data: { status: action === 'deactivate' ? 'deactivated' : 'verified' },
      message: `${org.name} ${action === 'deactivate' ? 'deactivated — all member accounts suspended' : 'activated — member accounts restored'}`,
    });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e.status === 403) return forbidden();
    return handleRouteError(e);
  }
}

// ── DELETE /api/admin/authority-orgs/[id] — soft-delete org + memberships ─────
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const admin_user = await requirePlatformAdmin(req);
    const { id } = await params;
    const admin = getSupabaseAdmin();

    const org = await getOrg(admin, id);
    if (!org) return NextResponse.json({ error: 'Regulator organisation not found' }, { status: 404 });

    const now = new Date().toISOString();
    await admin.from('company_members').update({ deleted_at: now }).eq('company_id', id).is('deleted_at', null);
    await admin.from('setup_invites').update({ deleted_at: now }).eq('company_id', id).is('deleted_at', null);
    const { error: delErr } = await admin.from('companies').update({ deleted_at: now }).eq('id', id);

    if (delErr) {
      console.error('[authority-orgs/id] DELETE:', delErr.message);
      return serverError();
    }

    await writeAuditLog({
      userId: admin_user.id,
      action: 'AUTHORITY_ORG_DELETED',
      entityType: 'companies',
      entityId: id,
      after: { name: org.name },
    });

    return NextResponse.json({ message: `${org.name} deleted` });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (e.status === 403) return forbidden();
    return handleRouteError(e);
  }
}
