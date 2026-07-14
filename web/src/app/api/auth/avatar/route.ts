import { NextRequest } from 'next/server';
import { getAuthenticatedUser, serverError, badRequest, handleRouteError, writeAuditLog } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/auth/avatar — upload profile picture
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('No file provided');

    if (!ALLOWED_TYPES.has(file.type)) {
      return badRequest('File type not allowed. Accepted: JPEG, PNG, WebP, GIF.');
    }

    if (file.size > MAX_SIZE) {
      return badRequest('File too large. Maximum size is 5MB.');
    }

    const ext = file.type.split('/')[1] || 'jpg';
    const storagePath = `${user.id}/avatar.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const admin = getSupabaseAdmin();

    // Delete old avatar if exists (upsert)
    const { data: existing } = await admin.storage.from('avatars').list(user.id);
    if (existing && existing.length > 0) {
      const oldPaths = existing.map(e => `${user.id}/${e.name}`);
      await admin.storage.from('avatars').remove(oldPaths);
    }

    const { error } = await admin.storage
      .from('avatars')
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    if (error) {
      console.error('[Avatar] Storage error:', error.message);
      return serverError();
    }

    const { data: { publicUrl } } = admin.storage
      .from('avatars')
      .getPublicUrl(storagePath);

    // Update profile
    const { error: updateErr } = await admin
      .from('user_profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (updateErr) {
      console.error('[Avatar] Profile update error:', updateErr.message);
      return serverError();
    }

    await writeAuditLog({
      userId: user.id,
      action: 'AVATAR_UPLOADED',
      entityType: 'user_profiles',
      entityId: user.id,
      after: { avatar_url: publicUrl },
      req,
    });

    return Response.json({ avatar_url: publicUrl });
  } catch (e: any) {
    return handleRouteError(e);
  }
}

// DELETE /api/auth/avatar — remove profile picture
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const admin = getSupabaseAdmin();

    const { data: files } = await admin.storage.from('avatars').list(user.id);
    if (files && files.length > 0) {
      const paths = files.map(f => `${user.id}/${f.name}`);
      await admin.storage.from('avatars').remove(paths);
    }

    await admin
      .from('user_profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);

    return Response.json({ success: true });
  } catch (e: any) {
    return handleRouteError(e);
  }
}
