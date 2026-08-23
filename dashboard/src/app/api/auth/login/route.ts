import { NextResponse } from 'next/server';
import { getUserByEmail, createUser } from '@/lib/db';
import { comparePassword, hashPassword, signToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    let authUserId = '';
    let authUserName = '';

    // 1. First check MongoDB / Local database
    const dbUser = await getUserByEmail(normalizedEmail);
    if (dbUser) {
      const isValid = await comparePassword(password, dbUser.passwordHash);
      if (isValid) {
        authUserId = dbUser.id;
        authUserName = dbUser.name || normalizedEmail.split('@')[0];
      }
    }

    // 2. If not matched, try Supabase Auth (and auto-sync to MongoDB)
    if (!authUserId && isSupabaseConfigured()) {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password
          });

          if (!error && data?.user) {
            authUserId = data.user.id;
            authUserName = data.user.user_metadata?.name || data.user.user_metadata?.full_name || normalizedEmail.split('@')[0];

            // Sync user to MongoDB
            const passwordHash = await hashPassword(password);
            await createUser({
              id: authUserId,
              name: authUserName,
              email: normalizedEmail,
              passwordHash
            });
          }
        }
      } catch (supabaseErr) {
        console.warn('[Login] Supabase signIn warning:', supabaseErr);
      }
    }

    if (!authUserId) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password. Please verify your credentials.' },
        { status: 401 }
      );
    }

    const token = signToken({
      id: authUserId,
      name: authUserName,
      email: normalizedEmail
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully!',
      user: {
        id: authUserId,
        name: authUserName,
        email: normalizedEmail
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
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to authenticate user.' },
      { status: 500 }
    );
  }
}
