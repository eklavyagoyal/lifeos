/**
 * lifeOS — Route Protection Middleware
 *
 * Runs on every request in the Edge Runtime.
 * Checks for a valid session cookie; redirects to /login if missing/invalid.
 *
 * Public routes (no auth required):
 * - /login
 * - /api/health
 * - /_next/* (static assets, HMR)
 * - /manifest.webmanifest
 * - /sw.js
 * - /offline
 * - /favicon.ico
 */

import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'lifeos-session';

/** Routes that don't require authentication */
const PUBLIC_PATHS = ['/login', '/api/health', '/manifest.webmanifest', '/sw.js', '/offline'];
const PUBLIC_PREFIXES = ['/_next/', '/favicon', '/icon'];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * HMAC-SHA256 session token verification (Edge-compatible).
 * Duplicated from auth service because middleware can't import Node.js modules.
 */
async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return false;

    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(payloadStr)
    );

    if (!valid) return false;

    // Check expiration
    const payloadJSON = atob(payloadStr.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJSON);
    const now = Math.floor(Date.now() / 1000);

    return payload.exp > now;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without auth
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const authSecret = process.env.AUTH_SECRET;

  // If AUTH_SECRET is not configured, skip auth (dev convenience)
  if (!authSecret || authSecret.length === 0) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return redirectToLogin(request);
  }

  // For HMAC verification, use the raw AUTH_SECRET as the signing key
  // (same key used in auth service to create tokens)
  const isValid = await verifyToken(sessionToken, authSecret);

  if (!isValid) {
    // Clear the invalid cookie and redirect
    const response = redirectToLogin(request);
    response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return response;
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  // Preserve the intended destination for redirect after login
  if (request.nextUrl.pathname !== '/') {
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - sw.js
     * We also handle these in isPublicRoute, but the matcher
     * improves performance by not invoking middleware at all.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js).*)',
  ],
};
