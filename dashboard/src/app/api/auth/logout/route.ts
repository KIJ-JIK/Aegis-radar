import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

export async function POST() {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[Logout] Supabase sign out notice:', err);
    }
  }

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully.'
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });

  return response;
}
