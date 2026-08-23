import { NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { getUserById } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const sessionUser = await getAuthUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({
        authenticated: false,
        user: null
      });
    }

    let dbUser = null;
    try {
      dbUser = await getUserById(sessionUser.id);
    } catch (err) {
      console.warn('[Me Route] DB lookup warning:', err);
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: dbUser?.id || sessionUser.id,
        name: dbUser?.name || sessionUser.name || sessionUser.email.split('@')[0],
        email: dbUser?.email || sessionUser.email,
        createdAt: dbUser?.createdAt || new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Session check error:', error);
    return NextResponse.json({
      authenticated: false,
      user: null,
      error: error.message
    });
  }
}
