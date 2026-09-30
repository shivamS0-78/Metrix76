import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getRolesFromClaims, supabaseAnonKey, supabaseUrl } from '@/lib/supabaseClient';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Determine allowed roles for this specific path
  let allowedRoles: string[] | null = null;

  if (pathname.startsWith('/evaluations/') && pathname.includes('/review')) {
    // Reviewing evaluation reports is for Approving Officers and Admins
    allowedRoles = ['APPROVER', 'ADMIN'];
  } else if (pathname === '/evaluations' || pathname.startsWith('/evaluations/')) {
    // Creating and running evaluation worksheets is strictly for Testing Technicians and Admins
    allowedRoles = ['TECHNICIAN', 'ADMIN'];
  } else if (pathname === '/verification' || pathname.startsWith('/verification/')) {
    // Verification queue and cryptographic approval is strictly for Approvers and Admins
    allowedRoles = ['APPROVER', 'ADMIN'];
  } else if (
    pathname === '/instruments' || pathname.startsWith('/instruments/') ||
    pathname === '/standards' || pathname.startsWith('/standards/') ||
    pathname === '/repository' || pathname.startsWith('/repository/') ||
    pathname === '/archive' || pathname.startsWith('/archive/')
  ) {
    // Core metrology registries require any authenticated role
    allowedRoles = ['TECHNICIAN', 'APPROVER', 'ADMIN'];
  }

  // If not a protected route, proceed immediately
  if (!allowedRoles) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Check verified Supabase user session
  let verifiedRoles: string[] = [];
  let isAuthenticated = false;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      isAuthenticated = true;
      const claims = {
        role: user.role,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
      };
      verifiedRoles = getRolesFromClaims(claims);
    }
  } catch {
    // Supabase auth fallback
  }

  // Check active role cookie
  const activeRoleCookie = request.cookies.get('oiml_active_role')?.value?.toUpperCase();
  if (activeRoleCookie && ['TECHNICIAN', 'APPROVER', 'ADMIN'].includes(activeRoleCookie)) {
    isAuthenticated = true;
    if (!verifiedRoles.includes(activeRoleCookie)) {
      verifiedRoles.push(activeRoleCookie);
    }
  }

  // If unauthenticated, redirect to login page immediately
  if (!isAuthenticated) {
    const redirectUrl = new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  const isAuthorized = allowedRoles.some((allowedRole) => verifiedRoles.includes(allowedRole));

  if (!isAuthorized) {
    // Tester attempted to access verification -> redirect to evaluations
    if (verifiedRoles.includes('TECHNICIAN') && !verifiedRoles.includes('ADMIN')) {
      const redirectUrl = new URL('/evaluations', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Approver attempted to access evaluations worksheet -> redirect to verification
    if (verifiedRoles.includes('APPROVER') && !verifiedRoles.includes('ADMIN')) {
      const redirectUrl = new URL('/verification', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Default redirect to home
    const redirectUrl = new URL('/', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/evaluations/:path*',
    '/verification/:path*',
    '/instruments/:path*',
    '/standards/:path*',
    '/repository/:path*',
    '/archive/:path*'
  ],
};
