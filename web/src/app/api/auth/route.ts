// This route is DEPRECATED — auth moved to Supabase.
// Login: POST /api/auth/login
// Signup: POST /api/auth/signup
// Session: GET /api/auth/session

import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
  return Response.json({ error: 'This endpoint is deprecated. Use /api/auth/session instead.' }, { status: 410 });
}

export async function POST(_req: NextRequest) {
  return Response.json({ error: 'This endpoint is deprecated. Use /api/auth/signup instead.' }, { status: 410 });
}
