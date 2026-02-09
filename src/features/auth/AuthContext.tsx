import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { keycloak } from './keycloak';

type AuthLevel = 1 | 2 | 3;
export type AuthUser = {
  email?: string;
  username?: string;
  roles: string[];
  groups: string[];
  level: AuthLevel;
  token?: string | null;
};

type AuthContextValue = {
  ready: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function inferLevel(email?: string, groups?: string[], roles?: string[]): AuthLevel {
  const lowerEmail = (email || '').toLowerCase();
  const groupSet = new Set((groups || []).map((g) => g.toLowerCase()));
  const roleSet = new Set((roles || []).map((r) => r.toLowerCase()));

  const wlDownload = String((import.meta as any)?.env?.VITE_WHITELIST_DOWNLOAD || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const wlWrite = String((import.meta as any)?.env?.VITE_WHITELIST_WRITE || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const grpDownload = String((import.meta as any)?.env?.VITE_SSO_GROUP_DOWNLOAD || '').toLowerCase();
  const grpWrite = String((import.meta as any)?.env?.VITE_SSO_GROUP_WRITE || '').toLowerCase();
  const roleDownload = String((import.meta as any)?.env?.VITE_SSO_ROLE_DOWNLOAD || '').toLowerCase();
  const roleWrite = String((import.meta as any)?.env?.VITE_SSO_ROLE_WRITE || '').toLowerCase();

  let level: AuthLevel = 1;
  const isSafran = lowerEmail.endsWith('@safrangroup.com');
  if (!isSafran) return 1;

  if (
    (grpDownload && groupSet.has(grpDownload)) ||
    (roleDownload && roleSet.has(roleDownload)) ||
    (wlDownload.length && wlDownload.includes(lowerEmail))
  ) {
    level = 2;
  }
  if (
    (grpWrite && groupSet.has(grpWrite)) ||
    (roleWrite && roleSet.has(roleWrite)) ||
    (wlWrite.length && wlWrite.includes(lowerEmail))
  ) {
    level = 3;
  }
  return level;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!keycloak) {
          // Dev fallback: restore session from sessionStorage if present
          try {
            const email = sessionStorage.getItem('email') || '';
            const username = sessionStorage.getItem('userId') || '';
            const role = (sessionStorage.getItem('role') || 'user').toLowerCase();
            if (username || email) {
              const level = inferLevel(email, [], []);
              setIsAuthenticated(true);
              setUser({ email, username, roles: [role], groups: [], level, token: null });
            } else {
              setIsAuthenticated(false);
              setUser(null);
            }
          } catch {
          setIsAuthenticated(false);
          setUser(null);
          } finally {
            setReady(true);
          }
          return;
        }
        const redirectUri =
          (import.meta as any)?.env?.VITE_SSO_REDIRECT_URI || window.location.origin + '/';
        const authenticated = await keycloak.init({
          onLoad: 'check-sso',
          pkceMethod: 'S256',
          redirectUri,
        });
        if (cancelled) return;
        setIsAuthenticated(authenticated);
        if (authenticated) {
          const tkParsed: any = keycloak.tokenParsed || {};
          const email = String(tkParsed?.email || '');
          const username = String(tkParsed?.preferred_username || tkParsed?.sub || '');
          const roles = [
            ...((tkParsed?.realm_access?.roles as string[]) || []),
            ...((tkParsed?.resource_access?.[(import.meta as any)?.env?.VITE_SSO_CLIENT_ID || '']?.roles as string[]) || []),
          ];
          const groups = (tkParsed?.groups as string[]) || [];
          const level = inferLevel(email, groups, roles);
          const token = keycloak.token || null;
          setUser({ email, username, roles, groups, level, token });
          try {
            if (username) sessionStorage.setItem('userId', username);
            if (email) sessionStorage.setItem('email', email);
            sessionStorage.setItem('role', level === 3 ? 'admin' : 'user');
            window.dispatchEvent(new Event('user-login'));
          } catch {}
        } else {
          setUser(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const api = useMemo<AuthContextValue>(() => {
    return {
      ready,
      isAuthenticated,
      user,
      login: async () => {
        if (!keycloak) {
          // Dev fallback: treat existing sessionStorage as authenticated
          const email = sessionStorage.getItem('email') || '';
          const username = sessionStorage.getItem('userId') || '';
          const role = (sessionStorage.getItem('role') || 'user').toLowerCase();
          if (username || email) {
            const level = inferLevel(email, [], []);
            setIsAuthenticated(true);
            setUser({ email, username, roles: [role], groups: [], level, token: null });
          }
          return;
        }
        const redirectUri =
          (import.meta as any)?.env?.VITE_SSO_REDIRECT_URI || window.location.origin + '/';
        await keycloak.login({ redirectUri });
      },
      logout: async () => {
          sessionStorage.removeItem('authed');
          sessionStorage.removeItem('userId');
          sessionStorage.removeItem('email');
          sessionStorage.removeItem('role');
        setIsAuthenticated(false);
        setUser(null);
        if (!keycloak) {
          // Non-SSO logout: just reload current page (will show login)
          window.location.reload();
          return;
        }
        // SSO logout: redirect back to current app base path
        const path = window.location.pathname;
        const proxyMatch = path.match(/^(.*\/proxy\/\d+)/);
        const basePath = proxyMatch ? proxyMatch[1] + '/' : '/';
        const redirectUri =
          (import.meta as any)?.env?.VITE_SSO_LOGOUT_REDIRECT_URI || window.location.origin + basePath;
        await keycloak.logout({ redirectUri });
      },
    };
  }, [ready, isAuthenticated, user]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


