import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/db';
import { comparePassword, signToken, AUTH_COOKIE_NAME } from '@/lib/auth';
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

    // 1. If Supabase Auth is configured, login via Supabase
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });

        if (error) {
          return NextResponse.json(
            { success: false, error: error.message },
            { status: 401 }
          );
        }

        const supabaseUser = data.user;
        const name = supabaseUser?.user_metadata?.name || supabaseUser?.user_metadata?.full_name || normalizedEmail.split('@')[0];

        return NextResponse.json({
          success: true,
          message: 'Logged in successfully via Supabase Auth!',
          user: {
            id: supabaseUser?.id || '',
            name,
            email: normalizedEmail
          }
        });
      }
    }

    // 2. Fallback to built-in auth for offline development
    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
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
