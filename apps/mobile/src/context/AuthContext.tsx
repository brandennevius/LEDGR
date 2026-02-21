import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    options?: { termsAccepted?: boolean; privacyAccepted?: boolean }
  ) => Promise<string | null>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

WebBrowser.maybeCompleteAuthSession();

const parseFragmentParams = (hash?: string) => {
  const fragment = hash?.startsWith('#') ? hash.slice(1) : hash;
  if (!fragment) return {} as Record<string, string>;

  const params = new URLSearchParams(fragment);
  return Object.fromEntries(params.entries());
};

const getAppLoginRedirectUrl = () => {
  const configured = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL;
  const fallback = "financialcoaching://login?verified=1";

  if (!configured) return fallback;

  try {
    const parsed = new URL(configured);
    parsed.pathname = "/login";
    parsed.search = "?verified=1";
    return parsed.toString();
  } catch {
    if (configured.includes("://")) {
      const [scheme] = configured.split("://");
      return `${scheme}://login?verified=1`;
    }
    return fallback;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isMounted) {
          setSession(data.session ?? null);
          setInitializing(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setInitializing(false);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      options?: { termsAccepted?: boolean; privacyAccepted?: boolean }
    ) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAppLoginRedirectUrl(),
          data: {
            termsAcceptedAt:
              options?.termsAccepted === true ? new Date().toISOString() : null,
            privacyAcceptedAt:
              options?.privacyAccepted === true ? new Date().toISOString() : null,
          },
        },
      });
      return error?.message ?? null;
    },
    []
  );

  const signInWithOAuth = useCallback(async (provider: 'google' | 'apple') => {
    if (Constants.appOwnership === 'expo') {
      return 'Google/Apple OAuth requires a development build. Run `npm run run:ios` (or `run:android`) and then `npm run dev-client`.';
    }

    const fallbackRedirect = AuthSession.makeRedirectUri({
      path: 'auth/callback',
      scheme: 'financialcoaching',
      native: 'financialcoaching://auth/callback',
    });
    const redirectTo =
      process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? fallbackRedirect;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return error.message;
    }

    if (!data?.url) {
      return 'Unable to start OAuth flow.';
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type !== 'success' || !result.url) {
      return 'OAuth cancelled.';
    }

    const parsedUrl = new URL(result.url);
    const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());
    const fragmentParams = parseFragmentParams(parsedUrl.hash);
    const params = {
      ...fragmentParams,
      ...queryParams,
    };

    const code = typeof params?.code === 'string' ? params.code : null;
    const errorDescription =
      typeof params?.error_description === 'string'
        ? params.error_description
        : null;
    const errorCode = typeof params?.error === 'string' ? params.error : null;

    if (!code) {
      const accessToken =
        typeof params?.access_token === 'string' ? params.access_token : null;
      const refreshToken =
        typeof params?.refresh_token === 'string' ? params.refresh_token : null;

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!setSessionError) {
          return null;
        }

        return setSessionError.message;
      }

      return (
        'Missing OAuth response code.' +
        (errorCode ? ` error=${errorCode}` : '') +
        (errorDescription ? ` description=${errorDescription}` : '') +
        ' Verify Supabase Redirect URLs include financialcoaching://auth/callback.'
      );
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    return exchangeError?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signInWithPassword,
      signUp,
      signInWithOAuth,
      signOut,
    }),
    [
      session,
      initializing,
      signInWithPassword,
      signUp,
      signInWithOAuth,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
