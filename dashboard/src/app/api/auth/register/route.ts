import { NextResponse } from 'next/server';
import { getUserByEmail, createUser } from '@/lib/db';
import { hashPassword, signToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const displayName = name && name.trim() ? name.trim() : normalizedEmail.split('@')[0];

    let userId = '';

    // 1. Supabase Auth registration
    if (isSupabaseConfigured()) {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: {
                name: displayName,
                full_name: displayName
              }
            }
          });

          if (!error && data?.user) {
            userId = data.user.id;
          }
        }
      } catch (supabaseErr) {
        console.warn('[Register] Supabase signUp warning:', supabaseErr);
      }
    }

    const passwordHash = await hashPassword(password);
    const existing = await getUserByEmail(normalizedEmail);
    const resolvedId = userId || existing?.id || undefined;

    const user = await createUser({
      id: resolvedId,
      name: displayName,
      email: normalizedEmail,
      passwordHash
    });

    const token = signToken({
      id: user.id,
      name: user.name || displayName,
      email: user.email || normalizedEmail
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account registered and authenticated!',
      user: {
        id: user.id,
        name: user.name || displayName,
        email: user.email || normalizedEmail
      },
      token
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register account.' },
      { status: 500 }
    );
  }
}
