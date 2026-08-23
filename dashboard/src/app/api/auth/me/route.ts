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

    const dbUser = await getUserById(sessionUser.id);
    if (!dbUser) {
      return NextResponse.json({
        authenticated: false,
        user: null
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        createdAt: dbUser.createdAt
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
