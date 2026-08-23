import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getSupabaseServerClient, isSupabaseConfigured } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'aegis-super-secure-jwt-secret-key-2026-hackathon';
export const AUTH_COOKIE_NAME = 'aegis_session';

export interface AuthSessionUser {
  id: string;
  name: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthSessionUser): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): AuthSessionUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthSessionUser;
    if (decoded && decoded.id && decoded.email) {
      return {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the authenticated user from Supabase session or JWT cookie/header
 */
export async function getAuthUserFromRequest(req?: Request | NextRequest): Promise<AuthSessionUser | null> {
  // 1. Check Supabase Auth if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user && !error) {
          const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
          return {
            id: user.id,
            name,
            email: user.email || ''
          };
        }
      }
    } catch (err) {
      console.warn('[Auth] Supabase session check error:', err);
    }
  }

  // 2. Check Authorization header for custom JWT
  if (req) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const user = verifyToken(token);
      if (user) return user;
    }

    // Check cookie in request headers
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const cookiesList = cookieHeader.split(';');
      for (const cookie of cookiesList) {
        const [name, ...rest] = cookie.trim().split('=');
        if (name === AUTH_COOKIE_NAME) {
          const token = rest.join('=');
          const user = verifyToken(token);
          if (user) return user;
        }
      }
    }
  }

  // 3. Next.js cookies() helper fallback for custom JWT
  try {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (cookieToken) {
      return verifyToken(cookieToken);
    }
  } catch {
    // Outside of server component context
  }

  return null;
}
