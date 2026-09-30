import { createBrowserClient, createServerClient } from '@supabase/ssr';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function decodeJwtPayload(token?: string) {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

export function getRolesFromClaims(claims: Record<string, any> | null): string[] {
  if (!claims) return [];

  const rawRoles: unknown[] = [];
  // Only server-controlled claims are trusted. user_metadata is user-writable and must NOT be used for roles.
  const candidates = [
    claims.role,
    claims.roles,
    claims.user_role,
    claims.userRole,
    claims.app_metadata?.role,
    claims.app_metadata?.roles,
  ];


  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    if (Array.isArray(candidate)) {
      rawRoles.push(...candidate);
    } else {
      rawRoles.push(candidate);
    }
  }

  const normalized: string[] = [];
  for (const r of rawRoles) {
    if (typeof r === 'string') {
      const clean = r.trim().toUpperCase();
      if (clean && !normalized.includes(clean)) {
        normalized.push(clean);
      }
    }
  }
  return normalized;
}

export function normalizePrimaryRole(roles: string[]): string | null {
  if (!roles || roles.length === 0) return null;
  for (const priority of ['ADMIN', 'APPROVER', 'TECHNICIAN']) {
    if (roles.includes(priority)) return priority;
  }
  return roles[0];
}

export function getRoleFromAccessToken(token?: string): string | null {
  const claims = decodeJwtPayload(token);
  if (!claims) return null;

  const roles = getRolesFromClaims(claims);
  return normalizePrimaryRole(roles);
}


export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        if (typeof document === 'undefined') return [];

        return document.cookie
          .split(';')
          .map((cookie) => cookie.trim())
          .filter(Boolean)
          .map((cookie) => {
            const separatorIndex = cookie.indexOf('=');
            const rawName = separatorIndex >= 0 ? cookie.slice(0, separatorIndex) : cookie;
            const rawValue = separatorIndex >= 0 ? cookie.slice(separatorIndex + 1) : '';
            return {
              name: decodeURIComponent(rawName),
              value: decodeURIComponent(rawValue),
            };
          });
      },
      setAll(cookiesToSet) {
        if (typeof document === 'undefined') return;

        cookiesToSet.forEach(({ name, value, options }) => {
          const cookieOptions = options ? { ...options } : {};
          const expires = cookieOptions.expires;
          const stringifiedOptions = [] as string[];

          if (expires) {
            const date = new Date(expires);
            stringifiedOptions.push(`expires=${date.toUTCString()}`);
          }

          if (cookieOptions.maxAge) {
            stringifiedOptions.push(`max-age=${cookieOptions.maxAge}`);
          }

          if (cookieOptions.sameSite) {
            stringifiedOptions.push(`samesite=${cookieOptions.sameSite}`);
          }

          if (cookieOptions.secure) {
            stringifiedOptions.push('secure');
          }

          if (cookieOptions.path) {
            stringifiedOptions.push(`path=${cookieOptions.path}`);
          }

          document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${stringifiedOptions.length ? `; ${stringifiedOptions.join('; ')}` : ''}`;
        });
      },
    },
  });
}

export function createSupabaseServerClient(cookieStore?: {
  getAll?: () => Array<{ name: string; value: string }>;
  setAll?: (cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void;
}) {
  const store = cookieStore ?? {
    getAll: () => [],
    setAll: () => undefined,
  };

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return store.getAll ? store.getAll() : [];
      },
      setAll(cookiesToSet) {
        if (store.setAll) {
          store.setAll(cookiesToSet);
        }
      },
    },
  });
}

export const supabase = createSupabaseBrowserClient();
